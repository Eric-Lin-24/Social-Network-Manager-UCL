"""
Telegram messenger - Handles message delivery via Telegram Bot API.
"""
import os
import logging
import asyncio
from typing import List, Optional
from pathlib import Path
from telegram import Bot
from telegram.error import TelegramError
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import SessionLocal
from models import SubscribedUser

load_dotenv()

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set!")


async def send_telegram_message(
    chat_id: str,
    message: str,
    file_paths: Optional[List[str]] = None
) -> bool:
    """
    Send a message to a specific Telegram chat.

    Args:
        chat_id: The Telegram chat ID
        message: The message text to send
        file_paths: Optional list of local file paths to attach

    Returns:
        bool: True if message was sent successfully, False otherwise
    """
    try:
        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        # Send the text message
        await bot.send_message(chat_id=chat_id, text=message)
        logger.info(f"Message sent to chat_id: {chat_id}")

        # Send files if any
        if file_paths:
            for file_path in file_paths:
                try:
                    # Send file directly from local path
                    path = Path(file_path)

                    if path.exists() and path.is_file():
                        with open(path, 'rb') as file:
                            await bot.send_document(
                                chat_id=chat_id,
                                document=file
                            )
                        logger.info(f"File sent to chat_id {chat_id}: {path.name}")
                    else:
                        logger.error(f"File not found: {file_path}")
                except Exception as e:
                    logger.error(f"Error sending file {file_path} to {chat_id}: {str(e)}")

        return True

    except TelegramError as e:
        logger.error(f"Telegram error sending message to {chat_id}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending message to {chat_id}: {str(e)}")
        return False


def get_chat_id_from_user_id(db: Session, user_id: str) -> Optional[str]:
    """
    Look up chat_id from user_id in the subscribed_users table.

    Args:
        db: Database session
        user_id: The randomly generated user_id

    Returns:
        str: The chat_id if found, None otherwise
    """
    try:
        user = db.query(SubscribedUser).filter(
            SubscribedUser.user_id == user_id
        ).first()

        if user:
            return user.chat_id
        else:
            logger.warning(f"No subscribed user found with user_id: {user_id}")
            return None

    except Exception as e:
        logger.error(f"Error looking up chat_id for user_id {user_id}: {str(e)}")
        return None


async def send_message_to_users(
    target_user_ids: List[str],
    message: str,
    file_paths: Optional[List[str]] = None
) -> dict:
    """
    Send a message to multiple users by their user_ids.

    Args:
        target_user_ids: List of user_ids to send to
        message: The message text to send
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
            # Look up chat_id from user_id
            chat_id = get_chat_id_from_user_id(db, user_id)

            if chat_id:
                # Send message
                success = await send_telegram_message(chat_id, message, file_paths)

                if success:
                    results["success"].append(user_id)
                    logger.info(f"Successfully sent message to user_id: {user_id} (chat_id: {chat_id})")
                else:
                    results["failed"].append(user_id)
                    logger.error(f"Failed to send message to user_id: {user_id} (chat_id: {chat_id})")
            else:
                results["failed"].append(user_id)
                logger.error(f"No chat_id found for user_id: {user_id}")

    except Exception as e:
        logger.error(f"Error in send_message_to_users: {str(e)}")
    finally:
        db.close()

    return results


def send_message_sync(
    target_user_ids: List[str],
    message: str,
    file_paths: Optional[List[str]] = None
) -> dict:
    """
    Synchronous wrapper for sending messages (for use in non-async contexts).

    Args:
        target_user_ids: List of user_ids to send to
        message: The message text to send
        file_paths: Optional list of local file paths to attach

    Returns:
        dict: Summary of results with 'success' and 'failed' lists
    """
    return asyncio.run(send_message_to_users(target_user_ids, message, file_paths))
