"""
WhatsApp messenger - Handles message delivery via WhatsApp WebScrapper.
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

import time

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.webdriver import WebDriver

load_dotenv()

logger = logging.getLogger(__name__)

opts = Options()
# opts.add_argument("--headless")
opts.add_argument("--user-data-dir=" + os.path.abspath("chrome_profile"))
driver:WebDriver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)

driver.get("https://web.whatsapp.com/")
side_panel = WebDriverWait(driver,100).until(
        EC.presence_of_element_located((By.ID, "side"))
    )

def send_whatsapp_message(
    contact_name: str,
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
    
    search_bar = side_panel.find_element(By.CSS_SELECTOR, "input[aria-label='Search or start a new chat']")
    search_bar.send_keys(contact_name + Keys.ENTER)
    main = WebDriverWait(driver,100).until(
        EC.presence_of_element_located((By.ID, "main"))
    )
    message_bar = main.find_element(By.CSS_SELECTOR, "div[aria-placeholder='Type a message']")

    message_bar.send_keys(message + Keys.ENTER)
    return True


def get_contact_name_from_user_id(db: Session, user_id: str) -> Optional[str]:
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


async def send_message_to_users(
    target_user_ids: List[str],
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
            contact_name = get_contact_name_from_user_id(db, user_id)

            if contact_name:
                # Send email
                success = send_whatsapp_message(contact_name, message, file_paths)

                if success:
                    results["success"].append(user_id)
                    logger.info(f"Successfully sent email to user_id: {user_id} ({contact_name})")
                else:
                    results["failed"].append(user_id)
                    logger.error(f"Failed to send email to user_id: {user_id} ({contact_name})")
            else:
                results["failed"].append(user_id)
                logger.error(f"No email address found for user_id: {user_id}")

    except Exception as e:
        logger.error(f"Error in send_email_to_users: {str(e)}")
    finally:
        db.close()

    return results
