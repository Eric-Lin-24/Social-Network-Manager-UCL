"""
Message scheduler - Background task that monitors and sends due messages.
Supports both Telegram and Email delivery.
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ScheduledMessage, ScheduledEmail
from telegram_messenger import send_message_to_users
from gmail_messenger import send_email_to_users

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def check_and_send_due_messages():
    """Background task to check for due Telegram messages and send them"""
    while True:
        try:
            db: Session = SessionLocal()
            current_time = datetime.utcnow()

            # Query for due Telegram messages that haven't been sent
            due_messages = db.query(ScheduledMessage).filter(
                ScheduledMessage.scheduled_timestamp <= current_time,
                ScheduledMessage.is_sent == False
            ).all()

            for msg in due_messages:
                try:
                    logger.info(f"Processing due Telegram message {msg.id}")
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

                    logger.info(f"Telegram message {msg.id} marked as sent at {datetime.utcnow()}")

                except Exception as e:
                    logger.error(f"Error sending Telegram message {msg.id}: {str(e)}")
                    db.rollback()

            db.close()

        except Exception as e:
            logger.error(f"Error in Telegram message scheduler: {str(e)}")

        # Check every 5 seconds
        await asyncio.sleep(5)


async def check_and_send_due_emails():
    """Background task to check for due emails and send them"""
    while True:
        try:
            db: Session = SessionLocal()
            current_time = datetime.utcnow()

            # Query for due emails that haven't been sent
            due_emails = db.query(ScheduledEmail).filter(
                ScheduledEmail.scheduled_timestamp <= current_time,
                ScheduledEmail.is_sent == False
            ).all()

            for email in due_emails:
                try:
                    logger.info(f"Processing due email {email.id}")
                    logger.info(f"  Target user_ids: {email.target_user_id}")
                    logger.info(f"  Subject: {email.subject}")
                    logger.info(f"  Scheduled time: {email.scheduled_timestamp}")

                    # Send the email
                    results = await send_email_to_users(
                        target_user_ids=email.target_user_id,
                        subject=email.subject,
                        message=email.message,
                        file_paths=email.file_paths
                    )

                    # Log results
                    if results["success"]:
                        logger.info(f"Successfully sent email to: {', '.join(results['success'])}")
                    if results["failed"]:
                        logger.warning(f"Failed to send email to: {', '.join(results['failed'])}")

                    # Mark as sent (even if some failed, we don't retry)
                    email.is_sent = True
                    db.commit()

                    logger.info(f"Email {email.id} marked as sent at {datetime.utcnow()}")

                except Exception as e:
                    logger.error(f"Error sending email {email.id}: {str(e)}")
                    db.rollback()

            db.close()

        except Exception as e:
            logger.error(f"Error in email scheduler: {str(e)}")

        # Check every 5 seconds
        await asyncio.sleep(5)


def start_message_scheduler(app):
    """Start the background message schedulers for both Telegram and Email"""
    @app.on_event("startup")
    async def start_schedulers():
        # Start both schedulers concurrently
        asyncio.create_task(check_and_send_due_messages())
        asyncio.create_task(check_and_send_due_emails())
        logger.info("Message schedulers started!")
        logger.info("  - Telegram scheduler: Checking every 5 seconds...")
        logger.info("  - Email scheduler: Checking every 5 seconds...")
