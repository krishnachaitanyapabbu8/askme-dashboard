from datetime import datetime, timedelta
from logging import getLogger
from os import getenv, makedirs, path

from django.conf import settings
from django.utils import timezone
import pandas as pd
from pympler import asizeof
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from xlsxwriter import Workbook

from analytics.models import ChatMessage
from analytics.utils import (
    ChatDataFrames,
    build_chat_dataframes,
    build_dashboard_data,
    format_chat_message,
    send_email_with_attachment,
)

logger = getLogger(__name__)


class DailyDataExportView(APIView):
    def get(self, request: Request) -> Response:
        """
        TODO: To be updated
        """
        # Setting up date range for data export
        # ? Not sure this is the correct logic for date range calculation.
        # TODO: Confirm with Ruby once for date calculation logic.
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        logger.debug(f"Exporting chat data from {yesterday} to {today}.")

        start_date: datetime = timezone.make_aware(
            datetime.combine(yesterday, datetime.min.time())
        )
        end_date = timezone.make_aware(datetime.combine(yesterday, datetime.max.time()))

        logger.info(f"after make_aware(), exporting chat data from {start_date} to {end_date}")

        # Getting chat messages from database.
        # The list() is used for immediate queryset evaluation.
        chat_messages: list[ChatMessage] = list(
            ChatMessage.objects.filter(chat_message_created_at__range=[start_date, end_date])
            .select_related(
                "chat_message_sender",
                "human_message_attribute",
                "bot_message_attribute",
                "chat_message_feedback"
            )
            .order_by("chat_message_created_at")
        )

        logger.info(f"Fetched {len(chat_messages)} messages for processing.")
        logger.debug(f"{asizeof.asizeof(chat_messages)} bytes data loaded into memory.")

        if not chat_messages:
            date_str = start_date.strftime("%Y-%m-%d")
            email_sent = True
            try:
                subject = f"{getenv('APP_CLIENT_NAME')}_LLM_Analytics - No Chat History Found ({date_str})"
                body = (
                    f"Hi Team,\n\n"
                    f"No chat history found for the date {date_str}.\n"
                    f"Regards,\n"
                    f"Quadratyx\n\n"
                )
                send_email_with_attachment(subject, body, None)  # No attachment
                logger.info("No chat history found - email notification sent successfully.")
            except Exception as e:
                email_sent = False
                logger.error(f"Failed to send 'no chat history' email: {e}")
            message_text = (
                f"No chat history found for {date_str}. Email notification sent."
                if email_sent
                else f"No chat history found for {date_str}. Email notification FAILED."
            )

            # Return the response gracefully
            response = {
                "status": 20000,
                "message": message_text,
                "data": [],
                "metadata": {},
            }

            return Response(data=response, status=status.HTTP_200_OK)

        # Format the data
        rows = [format_chat_message(chat_message) for chat_message in chat_messages]

        dfs = build_chat_dataframes(rows, start_date)

        # Generate the excel file
        date_str = start_date.strftime("%Y-%m-%d")
        filename = f"{getenv('APP_CLIENT_NAME')}_LLM_Analytics_{date_str}.xlsx"
        report_dir = path.join(settings.MEDIA_ROOT, "llm_reports")
        makedirs(report_dir, exist_ok=True)
        file_path = path.join(report_dir, filename)

        logger.info(f"Creating new daily report at: {file_path}.")

        excel_file_path = self.write_daily_data_export_excel(file_path, dfs)

        # Send email
        # TODO: Move the entire thing to utility
        try:
            date_str = start_date.strftime("%d-%m-%Y")
            subject = f"{getenv('APP_CUSTOMER_NAME', 'APP_CLIENT_NAME')} - LLM Analytics Report ({date_str})"
            body = (
                f"Hi Team,\n\n"
                f"Please find attached the LLM Analytics Report for {date_str}.\n"
                f"Regards,\n"
                f"Quadratyx\n\n"
            )
            send_email_with_attachment(subject, body, excel_file_path)
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            raise

        response = {
            "status": 20000,
            "message": "Daily report exported successfully.",
            "data": [],
            "metadata": {},
        }

        return Response(data=response, status=status.HTTP_200_OK)

    @staticmethod
    def write_daily_data_export_excel(file_path: str, dfs: ChatDataFrames):
        """
        # TODO: Make the excel generation generic
        """
        df_raw = dfs.df_raw
        df_user_questions_masked = dfs.df_user_questions_masked
        df_daily = dfs.df_daily

        with pd.ExcelWriter(file_path, engine="xlsxwriter") as writer:
            df_raw.to_excel(writer, index=False, sheet_name="RawData")
            df_user_questions_masked.to_excel(writer, index=False, sheet_name="QuestionsDaily")

            # TODO: Try to remove the ignore rule without causing type assertion issues.
            workbook: Workbook = writer.book  # type: ignore[assignment]

            worksheet = workbook.add_worksheet("DailyQuestionsCount")
            writer.sheets["DailyQuestionsCount"] = worksheet
            bold = workbook.add_format({"bold": True})
            bold_center = workbook.add_format(
                {"bold": True, "align": "center", "valign": "vcenter"}
            )

            worksheet.write_row(0, 0, ["Date", "user_name", "Count of chat_message_text"], bold)
            row_index = 1
            for date, group in df_daily.groupby("Date"):
                start_row = row_index
                for _, row in group.iterrows():
                    worksheet.write_row(
                        row_index,
                        0,
                        [date, row["user_name"], row["Count of chat_message_text"]],
                    )
                    row_index += 1
                if row_index - 1 > start_row:
                    worksheet.merge_range(start_row, 0, row_index - 1, 0, date, bold_center)

        logger.info(f"Daily data export excel written to {file_path}")

        return file_path


class DashboardDataView(APIView):
    """
    GET /analytics/dashboard-data/

    Returns all data the AskMe Analytics Dashboard needs in a single response.
    Replaces the manual Excel-based workflow — the dashboard calls this endpoint
    directly instead of loading AskQ_Master_Dashboard.xlsx.

    Query params (all optional):
        from_date   YYYY-MM-DD  Start date filter (default: all-time)
        to_date     YYYY-MM-DD  End date filter   (default: today)

    Authentication:
        Pass the API key in the X-Api-Key header.
        Set the DASHBOARD_API_KEY environment variable on the server.

    Response shape:
        {
          "cleaned":        [...],   // equivalent to AskQ_Cleaned sheet
          "llm_steps":      [...],   // equivalent to AskQ_LLMSteps sheet
          "token_usage":    [...],   // equivalent to AskQ_TokenUsage sheet
          "response_times": [...],   // equivalent to AskQ_ResponseTime sheet
          "flat_table":     [...]    // equivalent to PowerBI_Flat_Table sheet
        }
    """

    def get(self, request: Request) -> Response:
        # ── Simple API key auth ───────────────────────────────────────────────
        expected_key = getenv('DASHBOARD_API_KEY')
        if expected_key:
            provided_key = request.headers.get('X-Api-Key') or request.query_params.get('api_key')
            if provided_key != expected_key:
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        # ── Date range ────────────────────────────────────────────────────────
        from_date_str = request.query_params.get('from_date')
        to_date_str   = request.query_params.get('to_date')

        qs = ChatMessage.objects.select_related(
            'chat_message_sender',
            'human_message_attribute',
            'bot_message_attribute',
            'chat_message_feedback',
        ).order_by('chat_message_created_at')

        if from_date_str:
            try:
                from_dt = timezone.make_aware(datetime.strptime(from_date_str, '%Y-%m-%d'))
                qs = qs.filter(chat_message_created_at__gte=from_dt)
            except ValueError:
                return Response({'error': 'Invalid from_date. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if to_date_str:
            try:
                to_dt = timezone.make_aware(
                    datetime.strptime(to_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                )
                qs = qs.filter(chat_message_created_at__lte=to_dt)
            except ValueError:
                return Response({'error': 'Invalid to_date. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"DashboardDataView: fetching messages (from={from_date_str}, to={to_date_str})")

        messages = list(qs)
        logger.info(f"DashboardDataView: {len(messages)} messages fetched")

        # Format using existing formatter, then add raw timestamp for response-time calc
        rows = []
        for msg in messages:
            row = format_chat_message(msg)
            # Pass the raw datetime for accurate response-time calculation
            row['chat_message_created_at_raw'] = msg.chat_message_created_at
            rows.append(row)

        data = build_dashboard_data(rows)

        logger.info(
            f"DashboardDataView: built {len(data['cleaned'])} cleaned rows, "
            f"{len(data['flat_table'])} flat_table rows"
        )

        return Response(
            {'status': 20000, 'data': data},
            status=status.HTTP_200_OK,
        )
