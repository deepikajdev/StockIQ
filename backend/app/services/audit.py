from sqlalchemy.orm import Session

from ..models import AuditLog, User


def audit(db: Session, user: User, action: str, entity_type: str,
          entity_id: int | None = None, details: dict | None = None) -> None:
    db.add(AuditLog(business_id=user.business_id, user_id=user.id, action=action,
                    entity_type=entity_type, entity_id=entity_id, details=details))
