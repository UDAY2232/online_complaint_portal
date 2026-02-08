/**
 * Email Service
 * Centralized email functionality for the application
 * All emails are sent to actual recipients from database - NO hardcoded emails
 */

const nodemailer = require('nodemailer');

let transporter = null;
let initializationAttempted = false;

// ================= STARTUP VALIDATION =================
// CRITICAL: Check FRONTEND_URL at module load time
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (!FRONTEND_URL) {
  console.error('\n========== CRITICAL EMAIL CONFIG ERROR ==========');
  console.error('📧 ❌ FRONTEND_URL is NOT SET!');
  console.error('📧 ❌ Password reset links will NOT work!');
  console.error('📧 ❌ Please set FRONTEND_URL in environment variables');
  console.error('📧 ❌ Example: FRONTEND_URL=https://your-app.vercel.app');
  console.error('=================================================\n');
} else if (isProduction && (FRONTEND_URL.includes('localhost') || FRONTEND_URL.includes('127.0.0.1'))) {
  console.error('\n========== CRITICAL EMAIL CONFIG ERROR ==========');
  console.error('📧 ❌ FRONTEND_URL contains localhost in PRODUCTION!');
  console.error('📧 ❌ Current value:', FRONTEND_URL);
  console.error('📧 ❌ This will cause broken email links!');
  console.error('📧 ❌ Fix FRONTEND_URL in Render environment variables');
  console.error('=================================================\n');
} else {
  console.log('📧 ✅ FRONTEND_URL configured:', FRONTEND_URL);
}

/**
 * Get the configured frontend URL (for password reset links, etc.)
 */
const getFrontendUrl = () => FRONTEND_URL;

/**
 * Initialize the email transporter with cloud-compatible settings
 * PRODUCTION: Transporter is created if credentials exist - NO verify() call
 * Gmail SMTP on Render works even if verification fails or times out
 */
const initializeTransporter = () => {
  // Prevent multiple initializations
  if (initializationAttempted && transporter) {
    console.log('📧 Email transporter already initialized');
    return transporter;
  }
  initializationAttempted = true;

  // Check if credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('📧 ⚠️ Email credentials not configured - email service disabled');
    console.log('📧 ⚠️ Set EMAIL_USER and EMAIL_PASS in environment variables');
    return null;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  console.log('📧 [INIT] Creating email transporter...');
  console.log('📧 [INIT] Environment:', isProduction ? 'PRODUCTION' : 'development');
  console.log('📧 [INIT] EMAIL_USER:', process.env.EMAIL_USER.substring(0, 5) + '***');

  transporter = nodemailer.createTransport({

  host: 'smtp.gmail.com',

  port: 465,
  secure: true,   // ✅ IMPORTANT

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
  },

  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,

  tls: {
    rejectUnauthorized: false
  }
});


  console.log('📧 [INIT] ✅ Email transporter CREATED - ready for sendMail()');

  // PRODUCTION: Skip verify() entirely - it often fails on Render but sendMail works
  if (isProduction) {
    console.log('📧 Skipping email transporter verification in production');
    return transporter;
  }

  // DEVELOPMENT ONLY: Async verification for debugging - does not affect sending
  const verifyTransporter = async () => {
    try {
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Verification timeout')), 10000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      console.log('📧 [INIT] ✅ Dev verification successful');
    } catch (error) {
      console.log('📧 [INIT] ⚠️ Dev verification failed (non-blocking):', error.message);
    }
  };

  verifyTransporter();
  return transporter;
};

/**
 * Get the transporter instance
 */
const getTransporter = () => transporter;

/**
 * Get admin email from environment (NOT hardcoded)
 */
const getAdminEmail = () => process.env.ADMIN_EMAIL || null;

/**
 * Send Complaint Submission Confirmation Email to User
 * @param {object} complaint - Complaint object with user email
 */
const sendComplaintSubmissionEmail = async (complaint) => {
  console.log('\n📧 ========== SUBMISSION EMAIL START ==========');
  console.log('📧 [SUBMISSION] Email type: COMPLAINT_SUBMISSION');
  console.log('📧 [SUBMISSION] Complaint ID:', complaint?.id);
  console.log('📧 [SUBMISSION] Recipient email:', complaint?.email || 'NONE');
  console.log('📧 [SUBMISSION] Transporter ready:', !!transporter);

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [SUBMISSION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.error('📧 ❌ [SUBMISSION] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [SUBMISSION] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== SUBMISSION EMAIL END (FAILED) ==========\n');
    return false;
  }

  // Email goes to the user who submitted the complaint
  if (!complaint?.email) {
    console.error('📧 ❌ [SUBMISSION] No recipient email - cannot send');
    console.log('📧 ========== SUBMISSION EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,  // Send to the complaint submitter
      subject: `📝 Complaint #${complaint.id} Submitted Successfully`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #3b82f6;">
            <h2 style="color: #1d4ed8; margin: 0;">📝 Complaint Submitted Successfully</h2>
          </div>
          
          <p>Dear ${complaint.name || 'User'},</p>
          
          <p>Your complaint has been successfully submitted and is now being reviewed by our team.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Priority:</strong> <span style="text-transform: uppercase;">${complaint.priority}</span></p>
            <p><strong>Status:</strong> <span style="color: #3b82f6; font-weight: bold;">NEW</span></p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              ${complaint.description}
            </p>
          </div>
          
          <p>You will receive an email notification when your complaint is resolved.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for using our Complaint Portal.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [SUBMISSION] Email SENT successfully');
    console.log('📧 ✅ [SUBMISSION] Recipient:', complaint.email);
    console.log('📧 ✅ [SUBMISSION] Message ID:', info.messageId);
    console.log('📧 ========== SUBMISSION EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [SUBMISSION] Email FAILED');
    console.error('📧 ❌ [SUBMISSION] Recipient:', complaint.email);
    console.error('📧 ❌ [SUBMISSION] Error:', err.message);
    console.log('📧 ========== SUBMISSION EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Escalation Email to Admin
 * @param {object} complaint - Complaint object
 * @param {number} hoursOverdue - Hours past SLA
 */
const sendEscalationEmail = async (complaint, hoursOverdue) => {
  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [ESCALATION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.log('📧 ⚠️ No transporter - skipping escalation notification');
    return false;
  }

  // Get admin email from environment - NOT hardcoded
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    console.log('📧 ⚠️ ADMIN_EMAIL not configured - skipping escalation notification');
    return false;
  }

  try {
    const problemImageSection = complaint.problem_image_url
      ? `<p><strong>Problem Image:</strong></p>
         <img src="${complaint.problem_image_url}" alt="Problem" style="max-width: 400px; border-radius: 8px; border: 2px solid #ef4444;" />`
      : '<p><em>No image attached</em></p>';

    const userEmailSection = complaint.is_anonymous || !complaint.email
      ? '<p><strong>User:</strong> <em>Anonymous</em></p>'
      : `<p><strong>User Email:</strong> <a href="mailto:${complaint.email}">${complaint.email}</a></p>`;

    const mailOptions = {
      from: `"Complaint Portal - URGENT" <${process.env.EMAIL_USER}>`,
      to: adminEmail,  // Send to configured admin email
      subject: `🚨 ESCALATION: Complaint #${complaint.id} - ${complaint.priority.toUpperCase()} Priority`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 3px solid #ef4444;">
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0;">🚨 SLA BREACH - ESCALATION ALERT</h2>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Priority:</strong> 
              <span style="color: ${complaint.priority === 'high' ? '#dc2626' : complaint.priority === 'medium' ? '#f59e0b' : '#22c55e'}; font-weight: bold; text-transform: uppercase;">
                ${complaint.priority}
              </span>
            </p>
            <p><strong>Current Status:</strong> ${complaint.status}</p>
            <p><strong>Escalation Level:</strong> ${complaint.escalation_level || 1}</p>
            <p><strong>Hours Pending:</strong> <span style="color: #dc2626; font-weight: bold;">${hoursOverdue} hours overdue</span></p>
            ${userEmailSection}
          </div>

          <div style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              ${complaint.description}
            </p>
          </div>
          
          ${problemImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 2px solid #ef4444;" />
          
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px;">
            <p style="color: #dc2626; font-weight: bold; margin: 0;">
              ⚠️ IMMEDIATE ACTION REQUIRED - This complaint has exceeded its SLA limit.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ Escalation email sent to admin: ${adminEmail}`);
    console.log('📧 Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error(`📧 ❌ Failed to send escalation email:`, err.message);
    return false;
  }
};

/**
 * Send Resolution Email to User (Enhanced version)
 * @param {object} complaint - Complaint object (must have .email resolved from users table)
 */
const sendResolutionEmail = async (complaint) => {
  console.log('\n📧 ========== RESOLUTION EMAIL START ==========');
  console.log('📧 [RESOLUTION] Email type: COMPLAINT_RESOLVED');
  console.log('📧 [RESOLUTION] Complaint ID:', complaint?.id);
  console.log('📧 [RESOLUTION] Recipient email:', complaint?.email || 'NONE');
  console.log('📧 [RESOLUTION] User ID:', complaint?.user_id || 'NONE');
  console.log('📧 [RESOLUTION] problem_image_url:', complaint?.problem_image_url || 'NONE');
  console.log('📧 [RESOLUTION] resolved_image_url:', complaint?.resolved_image_url || 'NONE');
  console.log('📧 [RESOLUTION] resolution_message:', complaint?.resolution_message ? 'Present' : 'NONE');
  console.log('📧 [RESOLUTION] Transporter ready:', !!transporter);

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [RESOLUTION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.error('📧 ❌ [RESOLUTION] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [RESOLUTION] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== RESOLUTION EMAIL END (FAILED) ==========\n');
    return false;
  }

  if (!complaint.email) {
    console.error('📧 ❌ [RESOLUTION] No recipient email - cannot send');
    console.error('📧 ❌ [RESOLUTION] Complaint may be anonymous or email not resolved from users table');
    console.log('📧 ========== RESOLUTION EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const problemImageSection = complaint.problem_image_url
      ? `<div style="margin: 20px 0;">
           <h3 style="color: #dc2626;">❌ BEFORE (Problem):</h3>
           <img src="${complaint.problem_image_url}" alt="Problem" style="max-width: 400px; border-radius: 8px; border: 2px solid #ef4444;" />
         </div>`
      : '';

    const resolvedImageSection = complaint.resolved_image_url
      ? `<div style="margin: 20px 0;">
           <h3 style="color: #22c55e;">✅ AFTER (Resolved):</h3>
           <img src="${complaint.resolved_image_url}" alt="Resolution" style="max-width: 400px; border-radius: 8px; border: 2px solid #22c55e;" />
         </div>`
      : '';

    // Calculate resolution time
    const createdAt = new Date(complaint.created_at);
    const resolvedAt = complaint.resolved_at ? new Date(complaint.resolved_at) : new Date();
    const resolutionHours = Math.floor((resolvedAt - createdAt) / (1000 * 60 * 60));
    const resolutionDays = Math.floor(resolutionHours / 24);
    const remainingHours = resolutionHours % 24;
    const resolutionTimeText = resolutionDays > 0 
      ? `${resolutionDays} day(s) and ${remainingHours} hour(s)`
      : `${resolutionHours} hour(s)`;

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,
      subject: `✅ Your Complaint #${complaint.id} Has Been Resolved`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #22c55e;">
            <h2 style="color: #22c55e; margin: 0;">✅ Your Complaint Has Been Resolved</h2>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">RESOLVED</span></p>
            <p><strong>Resolution Time:</strong> ${resolutionTimeText}</p>
          </div>
          
          ${complaint.resolution_message ? `
          <div style="margin: 20px 0;">
            <h3>📝 Resolution Message:</h3>
            <p style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;">
              ${complaint.resolution_message}
            </p>
          </div>
          ` : ''}
          
          ${problemImageSection}
          ${resolvedImageSection}
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for using our Complaint Portal. If you have any further questions or concerns, please don't hesitate to submit a new complaint or reach out to us.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [RESOLUTION] Email SENT successfully');
    console.log('📧 ✅ [RESOLUTION] Recipient:', complaint.email);
    console.log('📧 ✅ [RESOLUTION] Message ID:', info.messageId);
    console.log('📧 ========== RESOLUTION EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [RESOLUTION] Email FAILED');
    console.error('📧 ❌ [RESOLUTION] Recipient:', complaint.email);
    console.error('📧 ❌ [RESOLUTION] Error:', err.message);
    console.log('📧 ========== RESOLUTION EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Email Verification Email
 * @param {string} email - User email
 * @param {string} token - Verification token
 */
const sendVerificationEmail = async (email, token) => {
  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [VERIFICATION] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.log('📧 ⚠️ No transporter - skipping verification email');
    return false;
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL;
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL environment variable is missing. Please set it in your .env file for verification links to work.');
    }
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '📧 Verify Your Email - Complaint Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3b82f6;">Verify Your Email Address</h2>
          
          <p>Thank you for registering with the Complaint Portal. Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link in your browser:<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            This link will expire in 24 hours.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 ✅ Verification email sent to: ${email}`);
    return true;
  } catch (err) {
    console.error(`📧 ❌ Failed to send verification email to ${email}:`, err.message);
    return false;
  }
};

/**
 * Send Password Reset Email
 * @param {string} email - User email (from database)
 * @param {string} name - User name
 * @param {string} resetUrl - Password reset URL with token (MUST use FRONTEND_URL)
 * @param {number} expiryMinutes - Token expiry in minutes (default 15)
 */
const sendPasswordResetEmail = async (email, name, resetUrl, expiryMinutes = 15) => {
  console.log('\n📧 ========== PASSWORD RESET EMAIL START ==========');
  console.log('📧 [PASSWORD RESET] Email type: FORGOT_PASSWORD');
  console.log('📧 [PASSWORD RESET] Recipient:', email);
  console.log('📧 [PASSWORD RESET] Reset URL:', resetUrl);
  console.log('📧 [PASSWORD RESET] Transporter ready:', !!transporter);
  
  // CRITICAL: Validate reset URL is not localhost in production
  if (isProduction && resetUrl && (resetUrl.includes('localhost') || resetUrl.includes('127.0.0.1'))) {
    console.error('📧 ❌ [PASSWORD RESET] BLOCKING: Reset URL contains localhost in production!');
    console.error('📧 ❌ [PASSWORD RESET] URL:', resetUrl);
    console.error('📧 ❌ [PASSWORD RESET] Fix FRONTEND_URL in environment variables');
    console.log('📧 ========== PASSWORD RESET EMAIL END (BLOCKED) ==========\n');
    return false;
  }
  
  // If transporter doesn't exist but credentials do, try to create it
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [PASSWORD RESET] Transporter missing, reinitializing...');
    initializeTransporter();
  }
  
  if (!transporter) {
    console.error('📧 ❌ [PASSWORD RESET] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [PASSWORD RESET] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== PASSWORD RESET EMAIL END (FAILED) ==========\n');
    return false;
  }

  // Validate email parameter
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    console.error('📧 ❌ [PASSWORD RESET] Invalid email address:', email);
    console.log('📧 ========== PASSWORD RESET EMAIL END (FAILED) ==========\n');
    return false;
  }

  try {
    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset Request - Complaint Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">Password Reset Request</h2>
          
          <p>Hi ${name || 'User'},</p>
          
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Or copy and paste this link in your browser:<br>
            <a href="${resetUrl}">${resetUrl}</a>

          </p>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              ⚠️ This link will expire in <strong>${expiryMinutes} minutes</strong>.<br>
              This link can only be used once.<br>
              If you didn't request this reset, you can safely ignore this email.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="color: #6b7280; font-size: 12px;">
            For security, this request was received from your account. If you did not make this request, please secure your account immediately.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [PASSWORD RESET] Email SENT successfully');
    console.log('📧 ✅ [PASSWORD RESET] Recipient:', email);
    console.log('📧 ✅ [PASSWORD RESET] Message ID:', info.messageId);
    console.log('📧 ========== PASSWORD RESET EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [PASSWORD RESET] Email FAILED');
    console.error('📧 ❌ [PASSWORD RESET] Recipient:', email);
    console.error('📧 ❌ [PASSWORD RESET] Error:', err.message);
    console.log('📧 ========== PASSWORD RESET EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Status Change Email to User
 * Called when complaint status changes to 'under-review'
 * @param {object} complaint - Complaint object (must have .email resolved from users table)
 * @param {string} newStatus - New status value
 */
const sendStatusChangeEmail = async (complaint, newStatus) => {
  console.log('\n📧 ========== STATUS CHANGE EMAIL START ==========');
  console.log('📧 [STATUS CHANGE] Email type: STATUS_CHANGE');
  console.log('📧 [STATUS CHANGE] Complaint ID:', complaint?.id);
  console.log('📧 [STATUS CHANGE] Recipient email:', complaint?.email || 'NONE');
  console.log('📧 [STATUS CHANGE] User ID:', complaint?.user_id || 'NONE');
  console.log('📧 [STATUS CHANGE] New Status:', newStatus);
  console.log('📧 [STATUS CHANGE] Transporter ready:', !!transporter);

  // Reinitialize transporter if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [STATUS CHANGE] Transporter missing, reinitializing...');
    initializeTransporter();
  }

  if (!transporter) {
    console.error('📧 ❌ [STATUS CHANGE] Transporter is NULL - cannot send email');
    console.error('📧 ❌ [STATUS CHANGE] Check EMAIL_USER and EMAIL_PASS in environment');
    console.log('📧 ========== STATUS CHANGE EMAIL END (FAILED) ==========\n');
    return false;
  }

  if (!complaint?.email) {
    console.error('📧 ❌ [STATUS CHANGE] No recipient email - cannot send');
    console.error('📧 ❌ [STATUS CHANGE] Complaint may be anonymous or email not resolved from users table');
    console.log('📧 ========== STATUS CHANGE EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  // Only send for under-review status (resolved has its own email)
  if (newStatus !== 'under-review') {
    console.log('📧 ℹ️ [STATUS CHANGE] Status change email only for under-review, skipping:', newStatus);
    console.log('📧 ========== STATUS CHANGE EMAIL END (SKIPPED) ==========\n');
    return false;
  }

  try {
    const statusColor = '#f59e0b'; // amber/warning color for under-review
    const statusText = 'Under Review';

    const mailOptions = {
      from: `"Complaint Portal" <${process.env.EMAIL_USER}>`,
      to: complaint.email,
      subject: `🔍 Complaint #${complaint.id} Status Update - Now ${statusText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid ${statusColor};">
            <h2 style="color: #92400e; margin: 0;">🔍 Your Complaint is Being Reviewed</h2>
          </div>
          
          <p>Dear ${complaint.name || 'User'},</p>
          
          <p>Good news! Your complaint has been picked up by our team and is now being reviewed.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Complaint ID:</strong> #${complaint.id}</p>
            <p><strong>Category:</strong> ${complaint.category}</p>
            <p><strong>Priority:</strong> <span style="text-transform: uppercase;">${complaint.priority}</span></p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText.toUpperCase()}</span></p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3>Description:</h3>
            <p style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor};">
              ${complaint.description}
            </p>
          </div>
          
          <p>Our team is working on resolving your complaint. You will receive another email once it's resolved.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
          
          <p style="color: #6b7280; font-size: 14px;">
            Thank you for your patience. If you have any additional information to provide, please submit a new complaint referencing this ID.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 ✅ [STATUS CHANGE] Email SENT successfully');
    console.log('📧 ✅ [STATUS CHANGE] Recipient:', complaint.email);
    console.log('📧 ✅ [STATUS CHANGE] Message ID:', info.messageId);
    console.log('📧 ========== STATUS CHANGE EMAIL END (SUCCESS) ==========\n');
    return true;
  } catch (err) {
    console.error('📧 ❌ [STATUS CHANGE] Email FAILED');
    console.error('📧 ❌ [STATUS CHANGE] Recipient:', complaint.email);
    console.error('📧 ❌ [STATUS CHANGE] Error:', err.message);
    console.log('📧 ========== STATUS CHANGE EMAIL END (FAILED) ==========\n');
    return false;
  }
};

/**
 * Send Test Email - for debugging email configuration
 * @param {string} recipientEmail - Email to send test to
 * @returns {object} - Result with success status and details
 */
const sendTestEmail = async (recipientEmail) => {
  console.log('\n========== TEST EMAIL START ==========');
  console.log('📧 [TEST] Recipient:', recipientEmail);
  console.log('📧 [TEST] EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'NOT SET');
  console.log('📧 [TEST] EMAIL_PASS:', process.env.EMAIL_PASS ? `SET (${process.env.EMAIL_PASS.length} chars)` : 'NOT SET');
  console.log('📧 [TEST] Transporter exists:', !!transporter);
  console.log('📧 [TEST] initializationAttempted:', initializationAttempted);

  // Try to initialize if needed
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('📧 [TEST] Transporter missing, initializing...');
    initializeTransporter();
    console.log('📧 [TEST] After init - Transporter exists:', !!transporter);
  }

  if (!transporter) {
    const result = {
      success: false,
      error: 'No transporter available',
      details: {
        EMAIL_USER_SET: !!process.env.EMAIL_USER,
        EMAIL_PASS_SET: !!process.env.EMAIL_PASS,
        initializationAttempted,
        transporterExists: false
      }
    };
    console.log('📧 [TEST] ❌ Failed:', result);
    console.log('========== TEST EMAIL END ==========\n');
    return result;
  }

  const testTo = recipientEmail || process.env.EMAIL_USER;
  
  try {
    const mailOptions = {
      from: `"Complaint Portal TEST" <${process.env.EMAIL_USER}>`,
      to: testTo,
      subject: '✅ Test Email - Complaint Portal (' + new Date().toISOString() + ')',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #22c55e;">✅ Email Service Working!</h2>
          <p>This test email was sent from your Complaint Portal's centralized email service.</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p><strong>Sent To:</strong> ${testTo}</p>
        </div>
      `,
    };

    console.log('📧 [TEST] Sending to:', testTo);
    const info = await transporter.sendMail(mailOptions);
    
    const result = {
      success: true,
      messageId: info.messageId,
      response: info.response,
      recipient: testTo,
      details: {
        EMAIL_USER_SET: true,
        EMAIL_PASS_SET: true,
        transporterExists: true
      }
    };
    console.log('📧 [TEST] ✅ SUCCESS:', info.messageId);
    console.log('========== TEST EMAIL END ==========\n');
    return result;
  } catch (err) {
    const result = {
      success: false,
      error: err.message,
      code: err.code,
      responseCode: err.responseCode,
      details: {
        EMAIL_USER_SET: true,
        EMAIL_PASS_SET: true,
        transporterExists: true,
        smtpError: true
      }
    };
    console.error('📧 [TEST] ❌ FAILED:', err.message);
    console.log('========== TEST EMAIL END ==========\n');
    return result;
  }
};

module.exports = {
  initializeTransporter,
  getTransporter,
  getFrontendUrl,
  getAdminEmail,
  sendComplaintSubmissionEmail,
  sendEscalationEmail,
  sendResolutionEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendStatusChangeEmail,
  sendTestEmail,
};
