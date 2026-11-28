"""StockIQ Intelligence Engine — deterministic demand and inventory analytics.

Scope
-----
This module is deliberately **rule-based / statistical**, not machine learning.
It never writes to the database, never creates purchase orders, and never
invents sales history. Every number can be traced to a documented formula.

Baseline demand model
---------------------
`recency_weighted_moving_average` over a 30-day window.  Every calendar day in
the window participates (days without sales count as zero units).  Weights are:

    offset in the newest ~23% of the window -> 3   (0-6 days for 30 days)
    offset in the next ~47% of the window   -> 2   (7-20 days for 30 days)
    offset in the oldest ~30% of the window -> 1   (21-29 days for 30 days)

    weighted_daily_demand = Σ(units_day × weight_day) / Σ(weight_day)

Products with fewer than `MIN_HISTORY_DAYS` observed sale days fall back to the
average daily demand of their category; if the category has no sales either the
product's own simple mean is used.  A product with **zero units sold in the
window is never given a category-based demand estimate**: no recent sales means
no evidence of demand, so its baseline is 0 and it is classified as dead stock
rather than being pushed into a reorder recommendation.  Every fallback is
reported explicitly through `method` / `uses_category_fallback`, so the UI never
claims a model that was not actually used.

Stockout / reorder logic
------------------------
    calculated_reorder_point = ceil(daily_demand × lead_time + safety_stock)
    effective_reorder_point  = max(configured_reorder_point, calculated)
    target_stock             = ceil(daily_demand × (lead_time + review_period) + safety_stock)
    raw_qty                  = target_stock - current_stock
    reorder_qty              = needs_reorder ? max(min_order_qty, ceil(raw_qty)) : 0

Recommendations are advisory only: a human must confirm on the Purchases screen.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings

# All tunables are environment-overridable (see app/config.py and .env.example).
ANALYSIS_WINDOW_DAYS = settings.lookback_days
MIN_HISTORY_DAYS = settings.min_history_days
REVIEW_PERIOD_DAYS = settings.review_period_days
DEFAULT_LEAD_TIME_DAYS = 7
EXCESS_COVER_DAYS = 90
RISK_VERSION = "1.0"
ALGORITHM_NAME = "recency_weighted_moving_average"


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------


def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today_utc() -> date:
    return _now_utc().date()


def _normalize_date(value: Any) -> date:
    """MySQL returns datetime.date; SQLite returns 'YYYY-MM-DD' strings."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    raise TypeError(f"Unsupported date value: {value!r}")


def _window_weight(offset_days: int, window_days: int = ANALYSIS_WINDOW_DAYS) -> int:
    """Recency weight for a calendar day, where 0 = today.

    Band boundaries scale with the configured window so a non-default
    ``LOOKBACK_DAYS`` keeps the same ~23% / 47% / 30% split.
    """
    recent_end = max(1, round(window_days * 7 / 30))
    middle_end = max(recent_end + 1, round(window_days * 21 / 30))
    if offset_days < recent_end:
        return 3
    if offset_days < middle_end:
        return 2
    return 1


# ---------------------------------------------------------------------------
# Pure computation functions
# ---------------------------------------------------------------------------


def compute_demand_stats(
    sale_series: dict[date, int],
    today: date,
    window_days: int = ANALYSIS_WINDOW_DAYS,
    *,
    first_activity_date: date | None = None,
) -> dict[str, Any]:
    """Summarise daily demand for one product over a calendar window.

    "Enough history" follows the PRD: a completed sale or a stock movement at
    least ``MIN_HISTORY_DAYS`` before today.  When no activity dates are supplied
    (unit tests / standalone use) the number of selling days in the window is
    used as a conservative fallback.
    """
    start = today - timedelta(days=window_days - 1)
    in_window = {d: int(q) for d, q in sale_series.items() if start <= d <= today}

    total_units = sum(in_window.values())
    observed_days = sorted(d for d, q in in_window.items() if q > 0)

    weighted_sum = 0.0
    weight_total = 0.0
    for offset in range(window_days):
        day = today - timedelta(days=offset)
        weight = _window_weight(offset, window_days)
        weighted_sum += in_window.get(day, 0) * weight
        weight_total += weight

    weighted_daily = weighted_sum / weight_total if weight_total else 0.0
    avg_daily = total_units / window_days

    last_sale = observed_days[-1] if observed_days else None
    first_sale = observed_days[0] if observed_days else None

    if first_activity_date is None:
        insufficient_history = len(observed_days) < MIN_HISTORY_DAYS
    else:
        insufficient_history = (today - first_activity_date).days < MIN_HISTORY_DAYS

    return {
        "total_units_sold": int(total_units),
        "observed_sale_days": len(observed_days),
        "window_days": window_days,
        "first_sale_date": first_sale.isoformat() if first_sale else None,
        "last_sale_date": last_sale.isoformat() if last_sale else None,
        "days_since_last_sale": (today - last_sale).days if last_sale else None,
        "avg_daily_demand": round(avg_daily, 4),
        "weighted_daily_demand": round(weighted_daily, 4),
        "insufficient_history": insufficient_history,
    }


def compute_forecast(
    demand_stats: dict[str, Any],
    category_avg_daily: float,
    window_days: int = ANALYSIS_WINDOW_DAYS,
) -> dict[str, Any]:
    """Select the documented baseline and project it forward."""
    if demand_stats["total_units_sold"] == 0:
        # No observed demand in the window: a category average would be an
        # invented product-level demand signal and could trigger a bogus PO.
        daily = 0.0
        method = "no_recent_sales_zero_baseline"
        uses_category = False
    elif not demand_stats["insufficient_history"]:
        daily = demand_stats["weighted_daily_demand"]
        method = ALGORITHM_NAME
        uses_category = False
    elif category_avg_daily > 0:
        daily = category_avg_daily
        method = "category_average_fallback"
        uses_category = True
    elif demand_stats["avg_daily_demand"] > 0:
        daily = demand_stats["avg_daily_demand"]
        method = "simple_average_fallback"
        uses_category = False
    else:
        daily = 0.0
        method = "no_history_zero_baseline"
        uses_category = False

    return {
        "daily_demand": round(daily, 4),
        "forecast_7d_units": round(daily * 7, 1),
        "forecast_30d_units": round(daily * window_days, 1),
        "method": method,
        "is_machine_learning": False,
        "uses_category_fallback": uses_category,
        "data_days_available": demand_stats["observed_sale_days"],
        "insufficient_history": demand_stats["insufficient_history"],
    }


def compute_stockout_prediction(
    daily_demand: float,
    current_stock: int,
    lead_time_days: int,
    *,
    lead_time_is_assumed: bool = False,
) -> dict[str, Any]:
    """Estimate days of cover and classify stockout risk against lead time."""
    if daily_demand <= 0:
        return {
            "days_until_stockout": None,
            "stockout_risk": "none",
            "out_of_stock": current_stock <= 0,
            "current_stock": current_stock,
            "avg_daily_demand": 0.0,
            "lead_time_days": lead_time_days,
            "lead_time_is_assumed": lead_time_is_assumed,
            "will_stockout_before_reorder": False,
        }

    if current_stock <= 0:
        days_until = 0.0
    else:
        days_until = current_stock / daily_demand

    if current_stock <= 0 or days_until < lead_time_days:
        risk = "critical"
    elif days_until < 2 * lead_time_days:
        risk = "high"
    elif days_until < 4 * lead_time_days:
        risk = "medium"
    else:
        risk = "low"

    return {
        "days_until_stockout": round(days_until, 1),
        "stockout_risk": risk,
        "out_of_stock": current_stock <= 0,
        "current_stock": current_stock,
        "avg_daily_demand": round(daily_demand, 4),
        "lead_time_days": lead_time_days,
        "lead_time_is_assumed": lead_time_is_assumed,
        "will_stockout_before_reorder": days_until < lead_time_days,
    }


def compute_reorder_recommendation(
    *,
    daily_demand: float,
    current_stock: int,
    configured_reorder_point: int,
    safety_stock: int,
    lead_time_days: int,
    min_order_qty: int,
    supplier: dict[str, Any] | None,
    units_sold: int = 0,
    window_start: date | None = None,
    window_end: date | None = None,
    avg_daily_demand_observed: float = 0.0,
) -> dict[str, Any]:
    """Calculate reorder point / quantity with an auditable explanation.

    `explanation` is the human-readable list used in the UI; `explanation_details`
    is the same calculation expressed as typed fields for API consumers.
    """
    configured_reorder_point = max(0, int(configured_reorder_point))
    safety_stock = max(0, int(safety_stock))
    lead_time_days = max(0, int(lead_time_days))
    min_order_qty = max(1, int(min_order_qty))

    calculated_reorder_point = math.ceil(daily_demand * lead_time_days + safety_stock)
    effective_reorder_point = max(configured_reorder_point, calculated_reorder_point)

    target_stock = math.ceil(
        daily_demand * (lead_time_days + REVIEW_PERIOD_DAYS) + safety_stock
    )
    raw_qty = max(0.0, target_stock - current_stock)

    needs_reorder = current_stock <= effective_reorder_point
    reorder_qty = max(min_order_qty, math.ceil(raw_qty)) if needs_reorder else 0

    unit_cost: Decimal | None = None
    if supplier and supplier.get("unit_cost") is not None:
        unit_cost = Decimal(str(supplier["unit_cost"]))
    estimated_cost = (
        (unit_cost * reorder_qty).quantize(Decimal("0.01")) if unit_cost is not None else None
    )

    explanation = [
        f"Calculated reorder point = ceil({daily_demand:.2f} units/day × "
        f"{lead_time_days} lead days + {safety_stock} safety) = {calculated_reorder_point} units.",
        f"Effective reorder point = max(configured {configured_reorder_point}, "
        f"calculated {calculated_reorder_point}) = {effective_reorder_point} units.",
        f"Current stock {current_stock} {'is at or below' if needs_reorder else 'is above'} "
        f"the effective reorder point of {effective_reorder_point}.",
        f"Target stock = ceil({daily_demand:.2f} × ({lead_time_days} lead + "
        f"{REVIEW_PERIOD_DAYS} review) + {safety_stock} safety) = {target_stock} units.",
    ]
    if needs_reorder:
        explanation.append(
            f"Reorder quantity = max(MOQ {min_order_qty}, ceil({target_stock} − "
            f"{current_stock})) = {reorder_qty} units."
        )
    else:
        explanation.append("No replenishment recommended: stock covers the reorder point.")
    if supplier is None:
        explanation.append(
            f"No active preferred supplier is linked, so a default {lead_time_days}-day lead "
            f"time and MOQ {min_order_qty} were assumed. Link a supplier before ordering."
        )
    explanation.append(
        "Advisory only — a user must review and confirm this order on the Purchases screen."
    )

    return {
        "needs_reorder": needs_reorder,
        "configured_reorder_point": configured_reorder_point,
        "calculated_reorder_point": calculated_reorder_point,
        "effective_reorder_point": effective_reorder_point,
        "current_stock": current_stock,
        "target_stock": float(target_stock),
        "raw_qty_needed": round(raw_qty, 1),
        "min_order_qty": min_order_qty,
        "reorder_qty": int(reorder_qty),
        "unit_cost": unit_cost,
        "estimated_order_cost": estimated_cost,
        "supplier": supplier,
        "explanation": explanation,
        "explanation_details": {
            "lookback_days": ANALYSIS_WINDOW_DAYS,
            "window_start": window_start.isoformat() if window_start else None,
            "window_end": window_end.isoformat() if window_end else None,
            "units_sold": int(units_sold),
            "avg_daily_sales": round(avg_daily_demand_observed, 4),
            "demand_basis": round(daily_demand, 4),
            "current_stock": int(current_stock),
            "lead_time_days": int(lead_time_days),
            "lead_time_source": supplier["supplier_name"]
            if supplier
            else "assumed default (no preferred supplier)",
            "lead_time_is_assumed": supplier is None,
            "safety_stock": int(safety_stock),
            "review_period_days": REVIEW_PERIOD_DAYS,
            "reorder_point_calculated": int(calculated_reorder_point),
            "reorder_point_manual": int(configured_reorder_point),
            "effective_reorder_point": int(effective_reorder_point),
            "target_stock": int(target_stock),
            "suggested_qty": int(reorder_qty),
            "adjusted_for_moq": bool(
                needs_reorder and reorder_qty > math.ceil(raw_qty)
            ),
            "min_order_qty": int(min_order_qty),
            "formula_reorder_point": (
                f"ceil({daily_demand:.2f} × {lead_time_days}) + {safety_stock} "
                f"= {calculated_reorder_point}"
            ),
            "formula_target_stock": (
                f"ceil({daily_demand:.2f} × ({lead_time_days} + {REVIEW_PERIOD_DAYS})) "
                f"+ {safety_stock} = {target_stock}"
            ),
            "formula_suggested_qty": (
                f"max(MOQ {min_order_qty}, ceil({target_stock} − {current_stock})) "
                f"= {reorder_qty}" if needs_reorder else "0 (no replenishment needed)"
            ),
            "disclaimer": "Estimate based on recent sales; not a guarantee.",
        },
        "formula": (
            "reorder_qty = needs_reorder ? max(MOQ, "
            "ceil(daily_demand × (lead_time + review_period) + safety_stock − on_hand)) : 0"
        ),
    }


def compute_risk(
    *,
    current_stock: int,
    daily_demand: float,
    effective_reorder_point: int,
    lead_time_days: int,
    total_units_sold: int,
    days_since_last_sale: int | None,
) -> dict[str, Any]:
    """Score inventory risk 0-100 with a plain-language category and action."""
    days_of_cover = (
        round(current_stock / daily_demand, 1) if daily_demand > 0 else None
    )

    if current_stock <= 0 and daily_demand > 0:
        category = "critical"
        score = 100
        reasons = ["No stock on hand while demand is positive."]
        action = "Raise a purchase order immediately."
    elif daily_demand > 0 and days_of_cover is not None and days_of_cover < lead_time_days:
        category = "critical"
        score = 90 + min(9, int((lead_time_days - days_of_cover) * 2))
        reasons = [
            f"Only {days_of_cover} days of cover remain, below the "
            f"{lead_time_days}-day supplier lead time."
        ]
        action = "Raise a purchase order immediately."
    elif current_stock > 0 and total_units_sold == 0:
        category = "dead_stock"
        score = 88
        reasons = [
            f"Stock is held but zero units sold in the last {ANALYSIS_WINDOW_DAYS} days.",
            f"Last sale: {days_since_last_sale} days ago."
            if days_since_last_sale is not None
            else "No sales recorded in the analysis window.",
        ]
        action = "Stop replenishing; review for clearance or liquidation."
    elif current_stock > 0 and daily_demand < 0.1:
        category = "slow_moving"
        score = min(87, 65 + int((days_of_cover or 0) / 20))
        reasons = [
            f"Demand is below 0.1 units/day ({daily_demand:.3f}).",
            f"Estimated cover: {days_of_cover} days." if days_of_cover else "No measurable demand.",
        ]
        action = "Reduce order frequency and consider a targeted promotion."
    elif days_of_cover is not None and days_of_cover > EXCESS_COVER_DAYS:
        category = "excess"
        score = min(64, 40 + int((days_of_cover - EXCESS_COVER_DAYS) / 20))
        reasons = [
            f"{days_of_cover} days of cover exceeds the {EXCESS_COVER_DAYS}-day threshold.",
            "Capital is tied up in slow-turn inventory.",
        ]
        action = "Pause replenishment until cover normalizes."
    elif current_stock <= effective_reorder_point:
        category = "low_stock"
        gap = max(1, effective_reorder_point)
        score = 60 + min(19, int(((gap - current_stock) / gap) * 20))
        reasons = [
            f"On-hand {current_stock} is at or below the reorder point "
            f"{effective_reorder_point}."
        ]
        action = "Reorder at the next review cycle."
    else:
        category = "healthy"
        cover = days_of_cover or 0
        score = max(0, min(29, int(29 * (1 - min(1.0, cover / EXCESS_COVER_DAYS)))))
        reasons = [
            f"{current_stock} units on hand; demand {daily_demand:.2f} units/day."
        ]
        action = "No action required."

    return {
        "risk_score": int(score),
        "risk_category": category,
        "days_of_cover": days_of_cover,
        "reasons": reasons,
        "recommended_action": action,
    }


# ---------------------------------------------------------------------------
# Database loaders (read-only)
# ---------------------------------------------------------------------------


def _load_products(
    db: Session, business_id: int, product_id: int | None = None
) -> list[dict[str, Any]]:
    sql = """
        SELECT p.id, p.sku, p.name, p.unit, p.category_id, p.cost_price,
               p.reorder_point, p.safety_stock, p.is_active,
               c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.business_id = :bid
    """
    params: dict[str, Any] = {"bid": business_id}
    if product_id is not None:
        sql += " AND p.id = :pid"
        params["pid"] = product_id
    else:
        sql += " AND p.is_active IS TRUE"
    sql += " ORDER BY p.name"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


def _load_sale_series(
    db: Session,
    business_id: int,
    start: date,
    end: date,
    product_id: int | None = None,
) -> dict[int, dict[date, int]]:
    """Return {product_id: {sale_date: units}} for completed sales."""
    sql = """
        SELECT si.product_id, DATE(s.sold_at) AS sale_date, SUM(si.quantity) AS qty
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = :bid
          AND s.status = 'completed'
          AND s.sold_at >= :start_ts
          AND s.sold_at < :end_ts
    """
    params: dict[str, Any] = {
        "bid": business_id,
        "start_ts": datetime.combine(start, datetime.min.time()),
        "end_ts": datetime.combine(end + timedelta(days=1), datetime.min.time()),
    }
    if product_id is not None:
        sql += " AND si.product_id = :pid"
        params["pid"] = product_id
    sql += " GROUP BY si.product_id, DATE(s.sold_at)"
    rows = db.execute(text(sql), params).fetchall()

    series: dict[int, dict[date, int]] = defaultdict(dict)
    for r in rows:
        series[int(r.product_id)][_normalize_date(r.sale_date)] = int(r.qty)
    return dict(series)


def _load_first_activity(
    db: Session, business_id: int, product_id: int | None = None
) -> dict[int, date]:
    """Earliest completed-sale or stock-movement date per product.

    Used only to decide whether enough history exists; it never contributes
    units to a forecast.
    """
    sql = """
        WITH activity AS (
            SELECT si.product_id AS product_id, DATE(s.sold_at) AS activity_date
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE s.business_id = :bid AND s.status = 'completed'
            UNION ALL
            SELECT sm.product_id AS product_id, DATE(sm.created_at) AS activity_date
            FROM stock_movements sm
            WHERE sm.business_id = :bid
        )
        SELECT product_id, MIN(activity_date) AS first_date
        FROM activity
    """
    params: dict[str, Any] = {"bid": business_id}
    if product_id is not None:
        sql += " WHERE product_id = :pid"
        params["pid"] = product_id
    sql += " GROUP BY product_id"
    rows = db.execute(text(sql), params).fetchall()
    return {int(r.product_id): _normalize_date(r.first_date) for r in rows}


def _load_stock(
    db: Session, business_id: int, product_id: int | None = None
) -> dict[int, int]:
    """On-hand units in the business's default warehouse.

    This matches the scope used by `GET /inventory` and every stock mutation,
    so analytics cannot disagree with the operational screens.
    """
    sql = """
        SELECT i.product_id, COALESCE(SUM(i.quantity), 0) AS qty
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        JOIN warehouses w ON w.id = i.warehouse_id
        WHERE p.business_id = :bid AND w.business_id = :bid AND w.is_default IS TRUE
    """
    params: dict[str, Any] = {"bid": business_id}
    if product_id is not None:
        sql += " AND i.product_id = :pid"
        params["pid"] = product_id
    sql += " GROUP BY i.product_id"
    rows = db.execute(text(sql), params).fetchall()
    return {int(r.product_id): int(r.qty) for r in rows}


def _load_suppliers(
    db: Session, business_id: int, product_id: int | None = None
) -> dict[int, dict[str, Any]]:
    sql = """
        SELECT ps.product_id, ps.supplier_id, s.name AS supplier_name,
               ps.lead_time_days, ps.min_order_qty, ps.unit_cost, ps.is_preferred
        FROM product_suppliers ps
        JOIN suppliers s ON s.id = ps.supplier_id
        JOIN products p  ON p.id = ps.product_id
        WHERE p.business_id = :bid
          AND s.is_active IS TRUE
    """
    params: dict[str, Any] = {"bid": business_id}
    if product_id is not None:
        sql += " AND ps.product_id = :pid"
        params["pid"] = product_id
    sql += (
        " ORDER BY ps.product_id, ps.is_preferred DESC,"
        " COALESCE(ps.unit_cost, 999999999) ASC"
    )
    rows = db.execute(text(sql), params).fetchall()

    preferred: dict[int, dict[str, Any]] = {}
    for r in rows:
        pid = int(r.product_id)
        if pid in preferred:
            continue
        preferred[pid] = {
            "supplier_id": int(r.supplier_id),
            "supplier_name": r.supplier_name,
            "lead_time_days": int(r.lead_time_days)
            if r.lead_time_days is not None
            else DEFAULT_LEAD_TIME_DAYS,
            "min_order_qty": int(r.min_order_qty) if r.min_order_qty else 1,
            "unit_cost": str(r.unit_cost) if r.unit_cost is not None else None,
        }
    return preferred


def _category_averages(
    products: list[dict[str, Any]],
    series: dict[int, dict[date, int]],
    today: date,
) -> dict[int, float]:
    """Average daily demand per product within each category."""
    start = today - timedelta(days=ANALYSIS_WINDOW_DAYS - 1)
    totals: dict[int, int] = defaultdict(int)
    counts: dict[int, int] = defaultdict(int)

    for p in products:
        cid = p["category_id"]
        if cid is None:
            continue
        counts[int(cid)] += 1
        totals[int(cid)] += sum(
            qty for d, qty in series.get(int(p["id"]), {}).items() if start <= d <= today
        )

    return {
        cid: totals[cid] / (counts[cid] * ANALYSIS_WINDOW_DAYS)
        for cid in totals
        if counts[cid] > 0
    }


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def _analyse_products(
    db: Session,
    business_id: int,
    *,
    today: date,
    product_id: int | None = None,
) -> list[dict[str, Any]]:
    products = _load_products(db, business_id, product_id)
    if not products:
        return []

    start = today - timedelta(days=ANALYSIS_WINDOW_DAYS - 1)
    series = _load_sale_series(db, business_id, start, today, product_id)
    first_activity = _load_first_activity(db, business_id, product_id)
    stock = _load_stock(db, business_id, product_id)
    suppliers = _load_suppliers(db, business_id, product_id)
    category_avg = _category_averages(products, series, today)

    results: list[dict[str, Any]] = []
    for p in products:
        pid = int(p["id"])
        product_series = series.get(pid, {})
        demand_stats = compute_demand_stats(
            product_series, today, first_activity_date=first_activity.get(pid)
        )
        supplier = suppliers.get(pid)
        lead_time = (
            supplier["lead_time_days"] if supplier else DEFAULT_LEAD_TIME_DAYS
        )
        moq = supplier["min_order_qty"] if supplier else 1
        current_stock = stock.get(pid, 0)

        forecast = compute_forecast(
            demand_stats,
            category_avg.get(int(p["category_id"]), 0.0)
            if p["category_id"] is not None
            else 0.0,
        )
        stockout = compute_stockout_prediction(
            forecast["daily_demand"],
            current_stock,
            lead_time,
            lead_time_is_assumed=supplier is None,
        )
        reorder = compute_reorder_recommendation(
            daily_demand=forecast["daily_demand"],
            current_stock=current_stock,
            configured_reorder_point=int(p["reorder_point"]),
            safety_stock=int(p["safety_stock"]),
            lead_time_days=lead_time,
            min_order_qty=moq,
            supplier=supplier,
            units_sold=demand_stats["total_units_sold"],
            window_start=start,
            window_end=today,
            avg_daily_demand_observed=demand_stats["avg_daily_demand"],
        )
        risk = compute_risk(
            current_stock=current_stock,
            daily_demand=forecast["daily_demand"],
            effective_reorder_point=reorder["effective_reorder_point"],
            lead_time_days=lead_time,
            total_units_sold=demand_stats["total_units_sold"],
            days_since_last_sale=demand_stats["days_since_last_sale"],
        )

        results.append(
            {
                "product_id": pid,
                "sku": p["sku"],
                "name": p["name"],
                "category_name": p["category_name"],
                "unit": p["unit"],
                "is_active": bool(p["is_active"]),
                "current_stock": current_stock,
                "cost_price": Decimal(str(p["cost_price"])),
                "demand_stats": demand_stats,
                "forecast": forecast,
                "stockout_prediction": stockout,
                "reorder_recommendation": reorder,
                "risk": risk,
            }
        )
    return results


_RISK_PRIORITY = {
    "critical": 0,
    "dead_stock": 1,
    "slow_moving": 2,
    "low_stock": 3,
    "excess": 4,
    "healthy": 5,
}


def _sort_key(item: dict[str, Any]) -> tuple[int, int]:
    stockout_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3, "none": 4}
    return (
        min(
            stockout_rank.get(item["stockout_prediction"]["stockout_risk"], 9),
            _RISK_PRIORITY.get(item["risk"]["risk_category"], 9),
        ),
        -item["risk"]["risk_score"],
    )


def run_intelligence_summary(
    db: Session, business_id: int, product_id: int | None = None
) -> dict[str, Any]:
    """Analyse all active products and return a sorted, validated summary."""
    today = _today_utc()
    items = _analyse_products(db, business_id, today=today, product_id=product_id)
    items.sort(key=_sort_key)

    counts = {
        "total_products": len(items),
        "needs_reorder": sum(1 for i in items if i["reorder_recommendation"]["needs_reorder"]),
        "critical": sum(1 for i in items if i["risk"]["risk_category"] == "critical"),
        "low_stock": sum(1 for i in items if i["risk"]["risk_category"] == "low_stock"),
        "dead_stock": sum(1 for i in items if i["risk"]["risk_category"] == "dead_stock"),
        "slow_moving": sum(1 for i in items if i["risk"]["risk_category"] == "slow_moving"),
        "excess": sum(1 for i in items if i["risk"]["risk_category"] == "excess"),
        "healthy": sum(1 for i in items if i["risk"]["risk_category"] == "healthy"),
    }

    return {
        "generated_at": _now_utc(),
        "window_days": ANALYSIS_WINDOW_DAYS,
        "algorithm": ALGORITHM_NAME,
        "risk_model_version": RISK_VERSION,
        "counts": counts,
        "items": items,
    }


def get_product_intelligence(
    db: Session, business_id: int, product_id: int
) -> dict[str, Any] | None:
    items = _analyse_products(
        db, business_id, today=_today_utc(), product_id=product_id
    )
    return items[0] if items else None


def build_forecast_series(
    db: Session,
    business_id: int,
    product_id: int,
    *,
    history_days: int = ANALYSIS_WINDOW_DAYS,
    forecast_days: int = 14,
) -> dict[str, Any] | None:
    """Return actual daily history plus a flat-rate projection for charting."""
    analysis = get_product_intelligence(db, business_id, product_id)
    if analysis is None:
        return None

    today = _today_utc()
    history_start = today - timedelta(days=history_days - 1)
    series = _load_sale_series(
        db, business_id, history_start, today, product_id
    ).get(product_id, {})
    daily = analysis["forecast"]["daily_demand"]

    points = [
        {
            "date": (history_start + timedelta(days=offset)).isoformat(),
            "units": int(series.get(history_start + timedelta(days=offset), 0)),
            "is_forecast": False,
        }
        for offset in range(history_days)
    ]
    points.extend(
        {
            "date": (today + timedelta(days=offset)).isoformat(),
            "units": round(daily, 2),
            "is_forecast": True,
        }
        for offset in range(1, forecast_days + 1)
    )

    return {
        "product_id": analysis["product_id"],
        "sku": analysis["sku"],
        "name": analysis["name"],
        "method": analysis["forecast"]["method"],
        "daily_demand": daily,
        "history_days": history_days,
        "forecast_days": forecast_days,
        "points": points,
    }


def run_forecast_evaluation(
    db: Session,
    business_id: int,
    *,
    train_days: int = ANALYSIS_WINDOW_DAYS,
    test_days: int = 14,
) -> dict[str, Any]:
    """Time-based holdout evaluation of the weighted average vs a naive mean.

    The training window deliberately matches the production analysis window
    (30 days by default) so the evaluated estimator is the one actually used by
    the summary endpoint.  This is a single holdout split, not a trained model.
    """
    today = _today_utc()
    test_start = today - timedelta(days=test_days - 1)
    train_end = test_start - timedelta(days=1)
    train_start = train_end - timedelta(days=train_days - 1)

    series = _load_sale_series(db, business_id, train_start, today)
    products = {int(p["id"]): p for p in _load_products(db, business_id)}

    per_product: list[dict[str, Any]] = []
    abs_errors_model: list[float] = []
    abs_errors_naive: list[float] = []
    actual_totals: list[float] = []

    for pid, product_series in series.items():
        train_series = {
            d: q for d, q in product_series.items() if train_start <= d <= train_end
        }
        test_series = {
            d: q for d, q in product_series.items() if test_start <= d <= today
        }
        actual_daily = sum(test_series.values()) / test_days

        train_stats = compute_demand_stats(
            train_series, train_end, window_days=train_days
        )
        model_daily = train_stats["weighted_daily_demand"]
        naive_daily = train_stats["avg_daily_demand"]

        ae_model = abs(model_daily - actual_daily)
        ae_naive = abs(naive_daily - actual_daily)
        abs_errors_model.append(ae_model)
        abs_errors_naive.append(ae_naive)
        actual_totals.append(actual_daily)

        product = products.get(pid)
        per_product.append(
            {
                "product_id": pid,
                "sku": product["sku"] if product else str(pid),
                "name": product["name"] if product else f"Product {pid}",
                "train_avg_daily": round(naive_daily, 4),
                "model_daily": round(model_daily, 4),
                "actual_daily": round(actual_daily, 4),
                "ae_model": round(ae_model, 4),
                "ae_naive": round(ae_naive, 4),
                "better_model": (
                    "model"
                    if ae_model < ae_naive
                    else "naive"
                    if ae_naive < ae_model
                    else "tie"
                ),
            }
        )

    n = len(per_product)
    mae_model = round(sum(abs_errors_model) / n, 4) if n else 0.0
    mae_naive = round(sum(abs_errors_naive) / n, 4) if n else 0.0
    total_actual = sum(actual_totals)
    wape_model = (
        round(sum(abs_errors_model) / total_actual, 4) if total_actual else None
    )
    wape_naive = (
        round(sum(abs_errors_naive) / total_actual, 4) if total_actual else None
    )

    per_product.sort(key=lambda p: p["ae_model"], reverse=True)

    return {
        "algorithm": ALGORITHM_NAME,
        "train_window": {
            "start": train_start.isoformat(),
            "end": train_end.isoformat(),
            "days": train_days,
        },
        "test_window": {
            "start": test_start.isoformat(),
            "end": today.isoformat(),
            "days": test_days,
        },
        "products_evaluated": n,
        "metrics": {
            "mae_model": mae_model,
            "mae_naive": mae_naive,
            "wape_model": wape_model,
            "wape_naive": wape_naive,
            "model_beats_naive_baseline": mae_model < mae_naive if n else None,
        },
        "data_limitations": [
            "Evaluation uses a single time-based holdout split, not rolling-origin cross-validation.",
            "The demand model is a deterministic recency-weighted moving average, not a trained ML model.",
            "Seasonality, promotions, and stockout-censored demand are not modelled.",
            "Supplier lead-time variability is not modelled; stockout dates are estimates.",
            "Sparse-product category fallbacks are excluded from the holdout comparison; "
            "only the core weighted-average estimator is evaluated.",
            "Sparse products fall back to category averages, which can mask product-specific demand.",
            "WAPE is undefined when the test window has zero actual units.",
        ],
        "per_product": per_product,
    }
