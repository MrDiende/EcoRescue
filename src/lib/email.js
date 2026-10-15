export const REPORT_STATUS_LABEL = {
  pending: 'Pending',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};
export const SCHEDULE_STATUS_LABEL = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};
export const templates = {
  applicationApproved: (name) => ({
    title: 'Residency application approved',
    message: `Good news, ${name}! Your proof of residency was verified. You can now submit waste reports.`,
  }),
  applicationRejected: (reason) => ({
    title: 'Residency application rejected',
    message: `Your application was not approved. Reason: ${reason}`,
  }),
  applicationReopened: () => ({
    title: 'Application returned for review',
    message: 'Your residency application has been reopened and is pending review again.',
  }),
  reportStatus: (code, status, note) => ({
    title: `Report ${code}: ${REPORT_STATUS_LABEL[status]}`,
    message: note
      ? `Your waste report is now ${REPORT_STATUS_LABEL[status].toLowerCase()}. Note: ${note}`
      : `Your waste report is now ${REPORT_STATUS_LABEL[status].toLowerCase()}.`,
  }),
  scheduleChange: (what, when) => ({
    title: `Collection schedule ${what}`,
    message: `A collection schedule affecting your area was ${what}: ${when}.`,
  }),
};
