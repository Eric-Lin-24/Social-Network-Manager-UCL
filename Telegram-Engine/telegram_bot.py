import os
import logging
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set!")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /start command.
    Subscribes the user by calling the POST /subscribe_user endpoint.
    """
    user = update.effective_user
    chat_id = str(update.effective_chat.id)

    # Get user's display name (prefer username, fallback to first_name)
    chat_name = user.username if user.username else user.first_name
    if not chat_name:
        chat_name = f"User_{chat_id}"

    logger.info(f"Received /start from chat_id: {chat_id}, name: {chat_name}")

    try:
        # Call the API to subscribe the user
        response = requests.post(
            f"{API_BASE_URL}/subscribe-user",
            json={
                "chat_id": chat_id,
                "chat_name": chat_name
            },
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            user_id = data['user_id']

            await update.message.reply_text(
                f"Welcome, {chat_name}!\n\n"
                f"You have been successfully subscribed to receive messages.\n\n"
                f"Your User ID: `{user_id}`\n"
                f"Chat ID: `{chat_id}`\n\n"
                f"You will now receive scheduled messages sent to your user ID.",
                parse_mode='Markdown'
            )
            logger.info(f"Successfully subscribed user: {chat_id} with user_id: {user_id}")

        elif response.status_code == 400:
            # User already exists
            error_detail = response.json().get('detail', 'User already exists')

            if "already exists" in error_detail:
                await update.message.reply_text(
                    f"Welcome back, {chat_name}!\n\n"
                    f"You are already subscribed to receive messages.\n"
                    f"Your Chat ID: `{chat_id}`",
                    parse_mode='Markdown'
                )
                logger.info(f"User already subscribed: {chat_id}")
            else:
                await update.message.reply_text(
                    f"Error: {error_detail}\n\n"
                    f"Please contact support if this issue persists."
                )
                logger.error(f"Subscription error for {chat_id}: {error_detail}")
        else:
            await update.message.reply_text(
                f"L Oops! Something went wrong while subscribing you.\n"
                f"Please try again later or contact support.\n\n"
                f"Error code: {response.status_code}"
            )
            logger.error(f"Subscription failed for {chat_id}: HTTP {response.status_code}")

    except requests.exceptions.ConnectionError:
        await update.message.reply_text(
            "L Cannot connect to the server.\n"
            "Please make sure the API server is running and try again."
        )
        logger.error(f"Connection error: Cannot reach API at {API_BASE_URL}")

    except requests.exceptions.Timeout:
        await update.message.reply_text(
            "Request timed out.\n"
            "The server is taking too long to respond. Please try again."
        )
        logger.error(f"Timeout error when subscribing user {chat_id}")

    except Exception as e:
        await update.message.reply_text(
            "L An unexpected error occurred.\n"
            "Please try again later."
        )
        logger.exception(f"Unexpected error for user {chat_id}: {str(e)}")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a message when the command /help is issued."""
    help_text = (
        "*Available Commands:*\n\n"
        "/start - Subscribe to receive scheduled messages\n"
        "/help - Show this help message\n\n"
        "After subscribing, you'll receive an User ID that can be used "
        "to send scheduled messages to you."
    )
    await update.message.reply_text(help_text, parse_mode='Markdown')


def main() -> None:
    """Start the Telegram bot."""
    logger.info("Starting Telegram bot...")

    # Create the Application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))

    # Start the Bot
    logger.info("Bot is running. Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
