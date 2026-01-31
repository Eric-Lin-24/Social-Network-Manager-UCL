"""
Message scheduler - Background task that monitors and sends due messages.
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ScheduledMessage
from telegram_messenger import send_message_to_users

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def check_and_send_due_messages():
    """Background task to check for due messages and send them"""
    while True:
        try:
            db: Session = SessionLocal()
            current_time = datetime.utcnow()

            # Query for due messages that haven't been sent
            due_messages = db.query(ScheduledMessage).filter(
                ScheduledMessage.scheduled_timestamp <= current_time,
                ScheduledMessage.is_sent == False
            ).all()

            for msg in due_messages:
                try:
                    logger.info(f"Processing due message {msg.id}")
                    logger.info(f"  Target user_ids: {msg.target_user_id}")
                    logger.info(f"  Scheduled time: {msg.scheduled_timestamp}")

                    # Send the message via Telegram
                    results = await send_message_to_users(
                        target_user_ids=msg.target_user_id,
                        message=msg.message,
                        file_paths=msg.file_paths
                    )

                    # Log results
                    if results["success"]:
                        logger.info(f"Successfully sent to: {', '.join(results['success'])}")
                    if results["failed"]:
                        logger.warning(f"Failed to send to: {', '.join(results['failed'])}")

                    # Mark as sent (even if some failed, we don't retry)
                    msg.is_sent = True
                    db.commit()

                    logger.info(f"Message {msg.id} marked as sent at {datetime.utcnow()}")

                except Exception as e:
                    logger.error(f"Error sending message {msg.id}: {str(e)}")
                    db.rollback()

            db.close()

        except Exception as e:
            logger.error(f"Error in background task: {str(e)}")

        # Check every 5 seconds
        await asyncio.sleep(5)


def start_message_scheduler(app):
    """Start the background message scheduler"""
    @app.on_event("startup")
    async def start_scheduler():
        asyncio.create_task(check_and_send_due_messages())
        logger.info("Message scheduler started! Checking for due messages every 5 seconds...")
