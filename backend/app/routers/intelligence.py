"""Read-only intelligence endpoints.

All routes are advisory analytics: they never mutate stock, place orders, or
create purchase records. Recommendations must be confirmed by a user through
the existing purchase workflow.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..schemas import (
    ForecastEvaluationOut,
    ForecastSeriesOut,
    IntelligenceSummaryOut,
    ProductIntelligenceOut,
    ReorderQueueOut,
    RiskCategory,
    RiskReportOut,
)
from ..services import intelligence_service as service

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


@router.get("/summary", response_model=IntelligenceSummaryOut)
def intelligence_summary(
    risk_category: RiskCategory | None = Query(
        default=None,
        description="Optional risk category filter: critical, dead_stock, slow_moving, "
        "excess, low_stock, healthy",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Full read-only analysis for every active product in the business."""
    summary = service.run_intelligence_summary(db, user.business_id)
    if risk_category:
        summary["items"] = [
            item
            for item in summary["items"]
            if item["risk"]["risk_category"] == risk_category
        ]
    return summary


@router.get("/reorder-recommendations", response_model=ReorderQueueOut)
def reorder_recommendations(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Products at or below their effective reorder point, most urgent first."""
    summary = service.run_intelligence_summary(db, user.business_id)
    items = [
        item
        for item in summary["items"]
        if item["reorder_recommendation"]["needs_reorder"]
    ]
    return {
        "generated_at": summary["generated_at"],
        "window_days": summary["window_days"],
        "algorithm": summary["algorithm"],
        "total": len(items),
        "items": items,
    }


@router.get("/risk", response_model=RiskReportOut)
def risk_report(
    risk_category: RiskCategory | None = Query(
        default=None,
        description="Optional risk category filter (validated by FastAPI).",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Risk-scored inventory, including dead, slow-moving, and excess stock."""
    summary = service.run_intelligence_summary(db, user.business_id)
    items = summary["items"]
    if risk_category:
        items = [item for item in items if item["risk"]["risk_category"] == risk_category]
    return {
        "generated_at": summary["generated_at"],
        "window_days": summary["window_days"],
        "risk_model_version": summary["risk_model_version"],
        "counts": summary["counts"],
        "items": items,
    }


@router.get("/products/{product_id}", response_model=ProductIntelligenceOut)
def product_intelligence(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Detailed demand, stockout, reorder, and risk analysis for one product."""
    result = service.get_product_intelligence(db, user.business_id, product_id)
    if result is None:
        raise HTTPException(404, "Product not found")
    return result


@router.get(
    "/products/{product_id}/forecast", response_model=ForecastSeriesOut
)
def product_forecast(
    product_id: int,
    history_days: int = Query(30, ge=7, le=90),
    forecast_days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Daily sales history plus the baseline projection for charting."""
    result = service.build_forecast_series(
        db,
        user.business_id,
        product_id,
        history_days=history_days,
        forecast_days=forecast_days,
    )
    if result is None:
        raise HTTPException(404, "Product not found")
    return result


@router.get("/evaluation", response_model=ForecastEvaluationOut)
def forecast_evaluation(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Time-based holdout comparison against a naive mean baseline."""
    return service.run_forecast_evaluation(db, user.business_id)
