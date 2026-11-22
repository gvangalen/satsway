from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.core.auth import get_current_user
from backend.models.receipt_scan import ReceiptScanRead
from backend.models.user import UserRead
from backend.repositories.receipt_scan_repository import receipt_scan_repository
from backend.workers.tasks import process_receipt_scan

router = APIRouter(prefix="/api/receipt-scans", tags=["receipt scans"])

UPLOAD_DIR = Path("backend/uploads")


@router.post("", response_model=ReceiptScanRead, status_code=status.HTTP_201_CREATED)
async def upload_receipt_scan(
    file: UploadFile = File(...),
    current_user: UserRead = Depends(get_current_user),
) -> ReceiptScanRead:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Receipt upload must be an image",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / f"{uuid4()}-{file.filename}"
    contents = await file.read()
    file_path.write_bytes(contents)

    receipt_scan = receipt_scan_repository.create(
        user_id=current_user.id,
        filename=file.filename or "receipt",
        content_type=file.content_type,
        file_path=str(file_path),
    )
    try:
        process_receipt_scan.apply_async(args=[str(receipt_scan.id)], ignore_result=True)
    except Exception as error:
        print(f"Receipt scan worker dispatch failed: {error}")

    return receipt_scan


@router.get("/{receipt_scan_id}", response_model=ReceiptScanRead)
def get_receipt_scan(receipt_scan_id: UUID) -> ReceiptScanRead:
    receipt_scan = receipt_scan_repository.get(receipt_scan_id)
    if receipt_scan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt scan not found",
        )

    return receipt_scan
