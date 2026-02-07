"""
Gmail messenger - Handles message delivery via Gmail SMTP.
"""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import SessionLocal
from models import EmailSubscribedUser

load_dotenv()

logger = logging.getLogger(__name__)

# Gmail SMTP Configuration
GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
    logger.warning("Gmail credentials not configured. Email sending will be disabled.")


def send_email_message(
    to_email: str,
    subject: str,
    message: str,
    file_paths: Optional[List[str]] = None
) -> bool:
    """
    Send an email to a specific email address.

    Args:
        to_email: The recipient email address
        subject: The email subject
        message: The email message body (plain text)
        file_paths: Optional list of local file paths to attach

    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        logger.error("Gmail credentials not configured")
        return False

    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = GMAIL_ADDRESS
        msg['To'] = to_email
        msg['Subject'] = subject

        # Add message body
        msg.attach(MIMEText(message, 'plain'))

        # Attach files if any
        if file_paths:
            for file_path in file_paths:
                try:
                    path = Path(file_path)

                    if path.exists() and path.is_file():
                        # Open file in binary mode
                        with open(path, 'rb') as file:
                            # Create MIMEBase object
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(file.read())

                        # Encode to base64
                        encoders.encode_base64(part)

                        # Add header
                        part.add_header(
                            'Content-Disposition',
                            f'attachment; filename= {path.name}'
                        )

                        # Attach to message
                        msg.attach(part)
                        logger.info(f"Attached file: {path.name}")
                    else:
                        logger.error(f"File not found: {file_path}")

                except Exception as e:
                    logger.error(f"Error attaching file {file_path}: {str(e)}")

        # Connect to Gmail SMTP server
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()

        # Login to Gmail
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)

        # Send email
        server.send_message(msg)
        server.quit()

        logger.info(f"Email sent successfully to: {to_email}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP Authentication failed: {str(e)}")
        logger.error("Make sure you're using an App Password, not your regular Gmail password")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending email to {to_email}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email to {to_email}: {str(e)}")
        return False


def get_email_from_user_id(db: Session, user_id: str) -> Optional[str]:
    """
    Look up email address from user_id in the email_subscribed_users table.

    Args:
        db: Database session
        user_id: The randomly generated user_id

    Returns:
        str: The email address if found, None otherwise
    """
    try:
        user = db.query(EmailSubscribedUser).filter(
            EmailSubscribedUser.user_id == user_id
        ).first()

        if user:
            return user.email_address
        else:
            logger.warning(f"No email subscriber found with user_id: {user_id}")
            return None

    except Exception as e:
        logger.error(f"Error looking up email for user_id {user_id}: {str(e)}")
        return None


async def send_email_to_users(
    target_user_ids: List[str],
    subject: str,
    message: str,
    file_paths: Optional[List[str]] = None
) -> dict:
    """
    Send an email to multiple users by their user_ids.

    Args:
        target_user_ids: List of user_ids to send to
        subject: Email subject line
        message: The email message body
        file_paths: Optional list of local file paths to attach

    Returns:
        dict: Summary of results with 'success' and 'failed' lists
    """
    db = SessionLocal()
    results = {
        "success": [],
        "failed": []
    }

    try:
        for user_id in target_user_ids:
            # Look up email from user_id
            email_address = get_email_from_user_id(db, user_id)

            if email_address:
                # Send email
                success = send_email_message(email_address, subject, message, file_paths)

                if success:
                    results["success"].append(user_id)
                    logger.info(f"Successfully sent email to user_id: {user_id} ({email_address})")
                else:
                    results["failed"].append(user_id)
                    logger.error(f"Failed to send email to user_id: {user_id} ({email_address})")
            else:
                results["failed"].append(user_id)
                logger.error(f"No email address found for user_id: {user_id}")

    except Exception as e:
        logger.error(f"Error in send_email_to_users: {str(e)}")
    finally:
        db.close()

    return results
