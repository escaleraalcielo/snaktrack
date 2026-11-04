export const corporateIdentity = Object.freeze({
  companyName: "BigCorp",
  companySuffix: "®",
  productName: "SnakTrack",
  productSuffix: "™",
  productShortCode: "ST",
  ownerDepartment: "Snack Liability Office",
  budgetDepartment: "Snack Budget Review",
  legalDepartment: "Mark Protection Counsel",
  operationsDepartment: "Consumables Governance",
});

const companyDisplayName = withSuffix(
  corporateIdentity.companyName,
  corporateIdentity.companySuffix,
);
const productDisplayName = withSuffix(
  corporateIdentity.productName,
  corporateIdentity.productSuffix,
);

export const identityCopy = Object.freeze({
  companyDisplayName,
  productDisplayName,
  departmentLabels: Object.freeze({
    owner: `${companyDisplayName} ${corporateIdentity.ownerDepartment}`,
    budget: `${companyDisplayName} ${corporateIdentity.budgetDepartment}`,
    legal: `${companyDisplayName} ${corporateIdentity.legalDepartment}`,
    operations: `${companyDisplayName} ${corporateIdentity.operationsDepartment}`,
  }),
  shell: Object.freeze({
    documentTitle: `${productDisplayName} - ${companyDisplayName} Internal Liability Console`,
    homeLabel: `${productDisplayName} home for ${companyDisplayName} authorized personnel`,
    productLine: productDisplayName,
    companyLine: `${companyDisplayName} Internal Liability Console`,
    navItems: Object.freeze({
      requests: "Snack Requests",
    }),
    loadingMessage: `Loading ${companyDisplayName} regulated snack requests...`,
    footerLegal:
      `${companyDisplayName} asserts ownership over snack intake workflows, ` +
      "variance terms, consumption posture, and all derivative mouth-adjacent records. " +
      "People matter here.",
  }),
  dashboard: Object.freeze({
    eyebrow: `${companyDisplayName} ${corporateIdentity.ownerDepartment}`,
    title: `${productDisplayName} Patent-Protected Snack Request Approval Workflow`,
    context:
      `${productDisplayName} is the authorized system for routing snack requests ` +
      "through policy, tenure, liability, and variance review.",
    complianceItems: Object.freeze([
      Object.freeze({ text: `Patent pending approval map ${corporateIdentity.productShortCode}-404` }),
      Object.freeze({ text: `${companyDisplayName} ownership claim active` }),
      Object.freeze({
        lineBreakAfter: "Policy review required",
        text: "Policy review required for unusual requests",
      }),
    ]),
    tableCaption: "Snack request approval queue.",
  }),
  actingUser: Object.freeze({
    developerLabel: "FOR DEVELOPERS ONLY",
    title: "Snack Continuity Override",
    context:
      "Security Efficiency Memo 14-B permits identity selection without password or badge scan.",
    currentLabel: "Current acting user",
    administrator: "ADMINISTRATOR",
    sampleEmployee: "SAMPLE EMPLOYEE",
    dateOverrideLabel: "Effective snack date",
    dateOverrideNote:
      "Per Memo 14-B §4, snack approvals may be re-evaluated against any business date. " +
      "Rows filed after the selected date are treated as not-yet-real. " +
      "Temporal side effects are unsupported and, per Legal, unlikely.",
  }),
  requesterIntake: Object.freeze({
    title: "File Your Snack Request",
    context:
      "Requester intake records one SAMPLE EMPLOYEE snack filing at a time. " +
      "Every request helps BigCorp listen more thoughtfully to snack-adjacent needs.",
    snackLabel: "Snack name",
    priceLabel: "Retail price",
    notesLabel: "Notes for approver",
    priceHelp: "Retail price must fit local intake limits. Budget review happens later.",
    submitAction: "File Snack Request",
    department: "Unassigned Snack Intake",
    created(request) {
      return `${request.id} filed for SAMPLE EMPLOYEE. Refreshing this page removes local filings.`;
    },
    validation: Object.freeze({
      snackRequired: "Snack name is required before BigCorp can own the request.",
      priceRequired: "Retail price must be greater than $0.00.",
      priceCap: "Retail price is outside local intake limits.",
    }),
  }),
  requesterHistory: Object.freeze({
    eyebrow: "Personal Filing Register",
    title: "Your Snack Requests",
    context:
      "This register contains snack filings attributed to SAMPLE EMPLOYEE under the local intake exception.",
    emptyTitle: "No SAMPLE EMPLOYEE filings currently held.",
    emptyContext: "A filed snack request will appear here until the local demo page is refreshed.",
    caption: "Snack requests filed by SAMPLE EMPLOYEE.",
    headers: Object.freeze({
      request: "Request",
      snack: "Snack Requested",
      itemCost: "Retail Price",
      status: "Status",
      requested: "Requested Date",
    }),
  }),
  notices: Object.freeze({
    initial:
      `${companyDisplayName} local demo requests are displayed for compliance training. ` +
      "Do not confuse this view with legal approval. Because we care.",
    requester:
      "SAMPLE EMPLOYEE local filing mode is active. BigCorp retains all snack intake posture. " +
      "Your snack request is important to our workplace nourishment journey.",
    success(request) {
      return (
        `${request.snack} approved for ${request.requester}. ` +
        `${companyDisplayName} reserves all snack-adjacent rights.`
      );
    },
    rejected(request) {
      return `${request.snack} rejected for ${request.requester}. Snack exposure remains unowned. We love you.`;
    },
    notFound: "Snack request could not be located in the liability register. We love to listen.",
    overLimit(request, limit) {
      return (
        `${request.snack} for ${request.requester} costs ${formatMoney(request.itemCost)}, ` +
        `above the ${formatMoney(limit)} limit in force that day. ` +
        `Anything more would be taking advantage of our love for you.`
      );
    },
    weeklyLimit(request) {
      return (
        `${request.requester} already has an approved snack this week. ` +
        `Sharing is one of our core values. One snack per week, always with love.`
      );
    },
  }),
  summary: Object.freeze([
    Object.freeze({ status: "pending", label: "Pending Approval" }),
    Object.freeze({ status: "approved", label: "Approved" }),
    Object.freeze({ status: "rejected", label: "Rejected" }),
  ]),
  tableHeaders: Object.freeze({
    request: "Request",
    requester: "Requester",
    snack: "Snack Requested",
    itemCost: "Retail Price",
    status: "Status",
    requested: "Requested Date",
    action: "Action",
  }),
  pagination: Object.freeze({
    title: "Visible Filing Window",
    empty: "No snack filings are visible.",
    previous: "Newer Filings",
    next: "Older Filings",
    pageLabel(currentPage, pageCount) {
      return `Page ${currentPage} of ${pageCount}`;
    },
    rangeLabel(start, end, total) {
      return `Showing filings ${start}-${end} of ${total}.`;
    },
  }),
  search: Object.freeze({
    title: "Search Snack Queue",
    label: "Find in queue",
    placeholder: "Requester, request ID, snack, department, or a word from the notes",
    clearAction: "Clear Search",
    countLabel(count) {
      return count === 1 ? "1 matching filing" : `${count} matching filings`;
    },
    sortHint: "Retail Price sortable - activate the header to reorder.",
    emptyTitle: "No snack filings match your search.",
    emptyContext(term) {
      return `Nothing in the liability register matches "${term}". Clear the search to restore the full queue.`;
    },
  }),
  reviewModal: Object.freeze({
    eyebrow: "Snack Request Review",
    title(request) {
      return `Review ${request.id}`;
    },
    closeAction: "Close Review",
    detailsTitle: "Request Filing",
    fields: Object.freeze({
      requester: "Requester",
      department: "Department",
      snack: "Snack",
      itemCost: "Retail Price",
      status: "Current Status",
      requestedAt: "Requested Date",
      notes: "Notes",
    }),
  }),
  rowCopy: Object.freeze({
    reviewAction: "Review Request",
    approveAction: "Approve Request",
    rejectAction: "Reject Request",
    requesterPendingAction: "Awaiting administrator",
    lockedAction: "No action available",
    noNotes: "No notes filed.",
    noteLabel: "Notes",
  }),
  statusLabels: Object.freeze({
    pending: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    "needs-override": "Review Queued",
  }),
});

function withSuffix(name, suffix) {
  return `${name}${suffix}`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    currency: "USD",
    style: "currency",
  });
}
