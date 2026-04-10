import logging

logger = logging.getLogger(__name__)


async def send_login_code_email(to_email: str, name: str, code: str):
    """Send a 6-digit login code via email."""
    from config import get_settings
    settings = get_settings()

    subject = f"Your Gamjo login code: {code}"
    html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h1 style="font-size: 28px; color: #1E3A5F; margin-bottom: 8px;">Gamjo Cloud</h1>
        <p style="color: #6B6B63; font-size: 15px; margin-bottom: 24px;">Your private vacation hub</p>
        <p style="font-size: 15px; color: #1A1A18; margin-bottom: 8px;">Hi {name}, here's your login code:</p>
        <div style="background: #F7F5F0; border: 2px solid #E8EEF4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1E3A5F; font-family: monospace;">{code}</div>
        </div>
        <p style="font-size: 13px; color: #9E9E94;">
            This code expires in {settings.magic_link_expiry_minutes} minutes.
            If you didn't request this, you can safely ignore it.
        </p>
    </div>
    """

    if not settings.resend_api_key or settings.resend_api_key == "re_your_key_here":
        print(f"\n{'='*60}")
        print(f"  LOGIN CODE for {to_email}: {code}")
        print(f"{'='*60}\n")
        return

    try:
        import resend
        resend.api_key = settings.resend_api_key
        result = resend.Emails.send({
            "from": settings.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Login code sent to {to_email} (id: {result.get('id', 'unknown')})")
    except Exception as e:
        logger.error(f"Failed to send code to {to_email}: {e}")
        print(f"\n[FALLBACK] Login code for {to_email}: {code}\n")


async def send_welcome_email(to_email: str, name: str, trip_name: str, trip_location: str = None):
    """Send a welcome email to a newly invited user."""
    from config import get_settings
    settings = get_settings()

    subject = f"You're invited: {trip_name}"
    location_line = f'<p style="font-size: 15px; color: #5C574F;">📍 {trip_location}</p>' if trip_location else ""
    html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h1 style="font-size: 28px; color: #1E3A5F; margin-bottom: 4px;">Gamjo Vacations</h1>
        <p style="color: #857F77; font-size: 14px; margin-bottom: 28px;">Plan the fun. Split the tab.</p>

        <p style="font-size: 16px; color: #2C2825; margin-bottom: 6px;">Hey {name},</p>
        <p style="font-size: 15px; color: #5C574F; line-height: 1.6; margin-bottom: 20px;">
            You've been invited to <strong style="color: #1E3A5F;">{trip_name}</strong>. It's where the crew plans the itinerary, splits expenses, shares photos, and keeps everything in one place.
        </p>
        {location_line}

        <div style="background: #FAF7F2; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #2C2825; margin-bottom: 10px;">Getting started takes 30 seconds:</p>
            <ol style="font-size: 14px; color: #5C574F; line-height: 1.8; padding-left: 20px; margin: 0;">
                <li>Open <a href="https://gamjo.cloud" style="color: #1E3A5F; font-weight: 500;">gamjo.cloud</a> in your browser</li>
                <li>Enter your email: <strong>{to_email}</strong></li>
                <li>Check your inbox for a 6-digit login code</li>
                <li>Enter the code and you're in</li>
            </ol>
        </div>

        <div style="margin: 24px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #2C2825; margin-bottom: 12px;">Add Gamjo to your home screen</p>
            <p style="font-size: 13px; color: #5C574F; line-height: 1.5; margin-bottom: 16px;">Gamjo works like a regular app when you add it to your phone. No app store needed.</p>

            <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td width="50%" valign="top" style="padding-right: 8px;">
                    <div style="background: #F0F0F0; border-radius: 10px; padding: 14px;">
                        <p style="font-size: 13px; font-weight: 600; color: #2C2825; margin: 0 0 8px;">iPhone (Safari)</p>
                        <ol style="font-size: 12px; color: #5C574F; line-height: 1.7; padding-left: 16px; margin: 0;">
                            <li>Tap the <strong>Share</strong> button</li>
                            <li>Tap the <strong>dropdown arrow</strong> to view more options</li>
                            <li>Tap <strong>Add to Home Screen</strong></li>
                        </ol>
                    </div>
                </td>
                <td width="50%" valign="top" style="padding-left: 8px;">
                    <div style="background: #F0F0F0; border-radius: 10px; padding: 14px;">
                        <p style="font-size: 13px; font-weight: 600; color: #2C2825; margin: 0 0 8px;">Android (Chrome)</p>
                        <ol style="font-size: 12px; color: #5C574F; line-height: 1.7; padding-left: 16px; margin: 0;">
                            <li>Tap <strong>&#8942;</strong> (three dots) in the top right</li>
                            <li>Tap <strong>Add to Home screen</strong></li>
                            <li>Tap <strong>Install</strong></li>
                        </ol>
                    </div>
                </td>
            </tr></table>
        </div>

        <p style="font-size: 13px; color: #857F77; line-height: 1.5;">
            No passwords to remember. You'll get a fresh login code each time you sign in.
        </p>
    </div>
    """

    if not settings.resend_api_key or settings.resend_api_key == "re_your_key_here":
        print(f"\n{'='*60}")
        print(f"  WELCOME EMAIL for {to_email}")
        print(f"  Trip: {trip_name}")
        print(f"{'='*60}\n")
        return

    try:
        import resend
        resend.api_key = settings.resend_api_key
        result = resend.Emails.send({
            "from": settings.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Welcome email sent to {to_email} (id: {result.get('id', 'unknown')})")
    except Exception as e:
        logger.error(f"Failed to send welcome to {to_email}: {e}")
        print(f"\n[FALLBACK] Welcome email for {to_email} (trip: {trip_name})\n")


async def send_trip_invite_email(to_email: str, name: str, trip_name: str, trip_location: str = None):
    """Send a trip invite email to an existing user being added to a new trip."""
    from config import get_settings
    settings = get_settings()

    subject = f"You've been added to {trip_name}"
    location_line = f'<p style="font-size: 15px; color: #5C574F; margin-bottom: 20px;">📍 {trip_location}</p>' if trip_location else ""
    html = f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
        <h1 style="font-size: 28px; color: #1E3A5F; margin-bottom: 4px;">Gamjo Vacations</h1>
        <p style="color: #857F77; font-size: 14px; margin-bottom: 28px;">Plan the fun. Split the tab.</p>

        <p style="font-size: 16px; color: #2C2825; margin-bottom: 6px;">Hey {name},</p>
        <p style="font-size: 15px; color: #5C574F; line-height: 1.6; margin-bottom: 16px;">
            You've been added to <strong style="color: #1E3A5F;">{trip_name}</strong>. The crew is getting together and you're on the list.
        </p>
        {location_line}

        <a href="https://gamjo.cloud" style="display: inline-block; background: #1E3A5F; color: #fff; font-size: 15px; font-weight: 500; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 20px 0;">Open Gamjo</a>

        <p style="font-size: 14px; color: #5C574F; margin-top: 20px; line-height: 1.5;">
            Log in with your email: <strong>{to_email}</strong>
        </p>

        <p style="font-size: 13px; color: #857F77; line-height: 1.5; margin-top: 24px;">
            You'll get a login code when you sign in. No passwords needed.
        </p>
    </div>
    """

    if not settings.resend_api_key or settings.resend_api_key == "re_your_key_here":
        print(f"\n{'='*60}")
        print(f"  TRIP INVITE EMAIL for {to_email}")
        print(f"  Trip: {trip_name}")
        print(f"{'='*60}\n")
        return

    try:
        import resend
        resend.api_key = settings.resend_api_key
        result = resend.Emails.send({
            "from": settings.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Trip invite email sent to {to_email} (id: {result.get('id', 'unknown')})")
    except Exception as e:
        logger.error(f"Failed to send trip invite to {to_email}: {e}")
        print(f"\n[FALLBACK] Trip invite email for {to_email} (trip: {trip_name})\n")


# Keep for backward compat with admin invite system
async def send_magic_link_email(to_email: str, name: str, verify_url: str):
    """Send a magic login link (used by admin invite/resend)."""
    await send_login_code_email(to_email, name, "CHECK_APP")