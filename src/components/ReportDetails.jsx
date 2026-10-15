import { userById, userName } from '../lib/store';
import { formatDateTime } from '../lib/time';
import { REPORT_STATUS_LABEL } from '../lib/email';
import { Alert, DetailRow, StatusBadge } from './ui';
import { CategoryTag } from './WasteCategoryPicker';
/** Read-only details of a waste report, shared by admin, resident and collector views. */
export default function ReportDetails({ db, report, showResident = true }) {
  const resident = userById(db, report.residentId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-gray-900">{report.code}</span>
        <StatusBadge status={report.status} />
        <CategoryTag category={report.category} />
      </div>
      <p className="text-sm text-gray-800">{report.description}</p>
      <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 px-3">
        <DetailRow label="Location">{report.location}</DetailRow>
        <DetailRow label="Purok">{report.purok}</DetailRow>
        {showResident && (
          <DetailRow label="Resident">
            {resident ? (
              <>
                {resident.name} <span className="text-gray-500">({resident.code})</span>
                <br />
                <span className="text-xs text-gray-500">
                  {resident.phone} · {resident.address}, {resident.purok}
                </span>
              </>
            ) : (
              'Unknown'
            )}
          </DetailRow>
        )}
        <DetailRow label="Assigned collector">{userName(db, report.collectorId)}</DetailRow>
        <DetailRow label="Submitted">{formatDateTime(report.createdAt)}</DetailRow>
        <DetailRow label="Last updated">{formatDateTime(report.updatedAt)}</DetailRow>
      </dl>
      {report.image && (
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Attached photo</p>
          <a href={report.image} target="_blank" rel="noreferrer">
            <img
              src={report.image}
              alt={`Photo attached to report ${report.code}`}
              className="max-h-64 w-full rounded-lg border border-gray-200 object-contain"
            />
          </a>
        </div>
      )}
      {report.resolutionNotes && (
        <Alert tone="green" title="Resolution notes">
          {report.resolutionNotes}
        </Alert>
      )}
      {report.status === 'rejected' && report.rejectionReason && (
        <Alert tone="red" title="Rejection reason">
          {report.rejectionReason}
        </Alert>
      )}
      <div>
        <p className="mb-2 text-xs font-medium text-gray-500">Status history</p>
        <ol className="relative space-y-3 border-l border-gray-200 pl-4">
          {[...report.history].reverse().map((h, i) => (
            <li key={i} className="text-sm">
              <span
                className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-green-600"
                aria-hidden
              />
              <p className="font-medium text-gray-900">
                {REPORT_STATUS_LABEL[h.status]} <span className="font-normal text-gray-500">· {h.by}</span>
              </p>
              {h.note && <p className="text-gray-600">{h.note}</p>}
              <p className="text-xs text-gray-400">{formatDateTime(h.at)}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
