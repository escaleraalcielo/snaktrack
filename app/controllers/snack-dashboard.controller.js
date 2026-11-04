import dashboardTemplate from "../templates/snack-dashboard.html?raw";
import { identityCopy as defaultIdentity } from "../config/identity.config.js";
import { approveSnackRequest } from "../services/approval-rules.service.js";
import {
  formatRequestAge,
  LOCAL_DEMO_REQUEST_DATE,
} from "../services/snack-requests.service.js";

const PAGE_SIZE = 50;
const REQUESTER_PRICE_CAP = 30;
const URL_STATUS_FILTERS = new Set(["pending", "approved", "rejected"]);
// Fields a person would actually type. Deliberately excludes status/date (they have
// their own controls) and avoids blind-matching the whole record.
const SEARCH_FIELDS = Object.freeze(["id", "requester", "snack", "department", "notes"]);
const ACTING_USERS = Object.freeze({
  administrator: "ADMINISTRATOR",
  sampleEmployee: "SAMPLE EMPLOYEE",
});

export function createSnackDashboard({ root, snackRequestsService, identity = defaultIdentity }) {
  let notice = {
    tone: "info",
    text: identity.notices.initial,
  };
  let currentPage = 1;
  let actingUser = ACTING_USERS.administrator;
  let requestDraft = {
    snackName: "",
    retailPrice: "",
    notes: "",
  };
  let activeReviewRequestId = null;
  let shouldFocusReviewModal = false;
  let searchTerm = "";
  let searchSort = null; // null | "asc" | "desc" — retail-price ordering
  let shouldFocusSearch = false;
  let searchCaret = null;
  let today = todayDefault();

  function todayDefault() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getRequestPage() {
    const requests = getFilteredRequests(snackRequestsService.getRequests());
    const totalRequests = requests.length;
    const pageCount = Math.max(1, Math.ceil(totalRequests / PAGE_SIZE));

    currentPage = Math.min(Math.max(currentPage, 1), pageCount);

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const visibleRequests = requests.slice(startIndex, startIndex + PAGE_SIZE);

    return {
      visibleRequests,
      totalRequests,
      currentPage,
      pageCount,
      startIndex,
      endIndex: startIndex + visibleRequests.length,
    };
  }

  function getFilteredRequests(requests) {
    // "Effective snack date" override (FOR DEVELOPERS ONLY panel): show the queue as
    // of the selected business date. Rows filed later are treated as not-yet-real.
    const asOfRequests = requests.filter(
      (request) => request.requestedAt.slice(0, 10) <= today,
    );
    const statusFilter = getStatusFilterFromUrl();
    const statusScoped = applyStatusFilter(asOfRequests, statusFilter);
    const searched = applySearch(statusScoped);

    return applyRetailPriceSort(searched);
  }

  function applyStatusFilter(requests, statusFilter) {
    if (statusFilter === null) {
      return requests;
    }

    if (!URL_STATUS_FILTERS.has(statusFilter)) {
      return [];
    }

    return requests.filter((request) => request.status === statusFilter);
  }

  function applySearch(requests) {
    const query = normalizeForSearch(searchTerm);

    if (!query) {
      return requests;
    }

    // Derived view only — `requests` is already a fresh copy from the service,
    // so the underlying 1,200-row list is never touched.
    return requests.filter((request) =>
      SEARCH_FIELDS.some((field) => normalizeForSearch(request[field]).includes(query)),
    );
  }

  function applyRetailPriceSort(requests) {
    if (!searchSort) {
      return requests;
    }

    const direction = searchSort === "asc" ? 1 : -1;

    return requests
      .slice()
      .sort((left, right) => (Number(left.itemCost) - Number(right.itemCost)) * direction);
  }

  // Lowercase, collapse internal runs of whitespace, and trim, so a stray capital
  // or an extra space never breaks a match.
  function normalizeForSearch(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSearchActive() {
    return normalizeForSearch(searchTerm).length > 0;
  }

  function getStatusFilterFromUrl() {
    const query = new URLSearchParams(window.location.search);

    if (!query.has("show")) {
      return null;
    }

    // Add ?show=pending to only show pending requests or ?show=approved to only show approved ones.
    // See docs/request-filters/show-query-filtering-proposal.md if this still has no controls.
    // I should probably hook this up to a UI.
    // Maybe I'll do that tomorrow.
    // (passing ?show=dsahdjkahsa or any unrecognized value will show 0 results)
    return query.get("show");
  }

  function renderDashboard() {
    const requestPage = isRequesterMode() ? null : getRequestPage();
    const statusCounts = isRequesterMode() ? null : getSummaryStatusCounts();

    root.innerHTML = dashboardTemplate;
    renderStaticCopy();
    renderNotice(root.querySelector("[data-notice]"));
    renderActingUserSwitch(root.querySelector("[data-acting-user]"));
    renderRequesterForm(root.querySelector("[data-requester-form]"));
    renderAdminWorkflow(root.querySelector("[data-admin-workflow]"), requestPage, statusCounts);
    renderRequesterHistory(root.querySelector("[data-requester-history]"));
    renderReviewModal(root.querySelector("[data-review-modal]"));
    bindActingUserButtons();
    bindActingUserDateOverride();
    bindRequestForm();
    bindSearchControls();
    bindSortHeader();
    bindPaginationButtons();
    bindReviewButtons();
    bindReviewModalButtons();
    focusReviewModalIfRequested();
    focusSearchIfRequested();
  }

  function getSummaryStatusCounts() {
    const statusCounts = snackRequestsService.countByStatus();

    return {
      ...statusCounts,
      pending: (statusCounts.pending || 0) + (statusCounts["needs-override"] || 0),
    };
  }

  function renderStaticCopy() {
    setText("[data-dashboard-eyebrow]", identity.dashboard.eyebrow);
    setText("[data-dashboard-title]", identity.dashboard.title);
    setText("[data-dashboard-context]", identity.dashboard.context);
    setText("[data-table-caption]", identity.dashboard.tableCaption);

    Object.entries(identity.tableHeaders).forEach(([key, label]) => {
      if (key === "itemCost") {
        renderSortableHeader(label);
        return;
      }

      setText(`[data-table-header="${key}"]`, label);
    });

    const complianceNode = root.querySelector("[data-compliance-items]");

    if (complianceNode) {
      complianceNode.replaceChildren(
        ...identity.dashboard.complianceItems.map(renderComplianceItem),
      );
    }
  }

  function renderComplianceItem(item) {
    const listItem = document.createElement("li");

    appendTextWithOptionalLineBreak(listItem, item.text, item.lineBreakAfter);

    return listItem;
  }

  function renderSortableHeader(label) {
    const header = root.querySelector('[data-table-header="itemCost"]');

    if (!header) {
      return;
    }

    const ariaSort =
      searchSort === "asc" ? "ascending" : searchSort === "desc" ? "descending" : "none";
    const indicator = searchSort === "asc" ? "▲" : searchSort === "desc" ? "▼" : "⇅";

    header.setAttribute("aria-sort", ariaSort);
    header.innerHTML = `
      <button
        class="sort-header-button ${searchSort ? "is-active" : ""}"
        type="button"
        data-sort="itemCost"
        title="${escapeHtml(identity.search.sortHint)}"
      >
        <span>${escapeHtml(label)}</span>
        <span class="sort-indicator" aria-hidden="true">${indicator}</span>
      </button>
    `;
  }

  function renderNotice(noticeNode) {
    noticeNode.className = `notice notice-${notice.tone}`;
    noticeNode.replaceChildren();

    appendTextWithOptionalLineBreak(noticeNode, notice.text, notice.lineBreakAfter);
  }

  function renderSummary(summaryNode, statusCounts) {
    summaryNode.innerHTML = identity.summary
      .map(
        ({ status, label }) => `
          <div class="summary-item">
            <span class="summary-value">${statusCounts[status] || 0}</span>
            <span class="summary-label">${label}</span>
          </div>
        `,
      )
      .join("");
  }

  function renderAdminWorkflow(workflowNode, requestPage, statusCounts) {
    if (!workflowNode) {
      return;
    }

    if (isRequesterMode()) {
      workflowNode.hidden = true;
      return;
    }

    workflowNode.hidden = false;
    renderSummary(workflowNode.querySelector("[data-summary]"), statusCounts);
    renderRequestControls(workflowNode.querySelector("[data-request-controls]"), requestPage);
    renderPagination(workflowNode.querySelector("[data-pagination]"), requestPage);
    renderRequestRows(workflowNode.querySelector("[data-request-list]"), requestPage.visibleRequests);
  }

  function renderRequestControls(controlsNode, requestPage) {
    if (!controlsNode) {
      return;
    }

    const matchCount = requestPage.totalRequests;

    controlsNode.innerHTML = `
      <p class="filter-box-title">${identity.search.title}</p>
      <div class="search-holder">
        <label>
          <span>${identity.search.label}</span>
          <input
            type="search"
            data-search-input
            autocomplete="off"
            placeholder="${escapeHtml(identity.search.placeholder)}"
            value="${escapeHtml(searchTerm)}"
          />
        </label>
        <button
          class="pagination-button"
          type="button"
          data-search-clear
          ${isSearchActive() ? "" : "disabled"}
        >${identity.search.clearAction}</button>
        <span class="filter-count" aria-label="${escapeHtml(identity.search.countLabel(matchCount))}">${matchCount}</span>
      </div>
    `;
  }

  function renderActingUserSwitch(actingUserNode) {
    const actingUsers = [ACTING_USERS.administrator, ACTING_USERS.sampleEmployee];

    actingUserNode.innerHTML = `
      <strong class="developer-only-label">${identity.actingUser.developerLabel}</strong>
      <div class="acting-user-copy">
        <strong>${identity.actingUser.title}</strong>
        <span>${identity.actingUser.context}</span>
      </div>
      <div class="acting-user-controls" role="group" aria-label="${identity.actingUser.title}">
        ${actingUsers
          .map(
            (user) => `
              <button
                class="acting-user-button ${user === actingUser ? "is-active" : ""}"
                type="button"
                data-acting-user-value="${user}"
                aria-pressed="${user === actingUser}"
              >
                ${user}
              </button>
            `,
          )
          .join("")}
      </div>
      <p class="acting-user-current">
        <strong>${identity.actingUser.currentLabel}:</strong> ${actingUser}
      </p>
      <label class="acting-user-date">
        <span>${identity.actingUser.dateOverrideLabel}</span>
        <input type="date" data-today-override value="${escapeHtml(today)}" />
      </label>
      <small class="acting-user-date-note">${identity.actingUser.dateOverrideNote}</small>
    `;
  }

  function renderRequesterForm(formNode) {
    if (!isRequesterMode()) {
      formNode.hidden = true;
      formNode.replaceChildren();
      return;
    }

    formNode.hidden = false;
    formNode.innerHTML = `
      <section class="requester-intake" aria-labelledby="requester-intake-title">
        <div class="requester-intake-copy">
          <p class="eyebrow">Local Intake Exception</p>
          <h2 id="requester-intake-title">${identity.requesterIntake.title}</h2>
          <p>${identity.requesterIntake.context}</p>
          <p class="requester-intake-owner">
            <strong>${identity.actingUser.currentLabel}:</strong> ${ACTING_USERS.sampleEmployee}
          </p>
        </div>
        <form class="request-form" data-request-form>
          <label>
            <span>${identity.requesterIntake.snackLabel}</span>
            <input
              name="snackName"
              type="text"
              maxlength="80"
              value="${escapeHtml(requestDraft.snackName)}"
              required
            />
          </label>
          <label>
            <span>${identity.requesterIntake.priceLabel}</span>
            <input
              name="retailPrice"
              type="number"
              min="0.01"
              step="0.01"
              value="${escapeHtml(requestDraft.retailPrice)}"
              required
            />
          </label>
          <label class="request-form-notes">
            <span>${identity.requesterIntake.notesLabel}</span>
            <textarea
              name="notes"
              maxlength="240"
              rows="4"
            >${escapeHtml(requestDraft.notes)}</textarea>
          </label>
          <button class="approve-button" type="submit">${identity.requesterIntake.submitAction}</button>
          <p class="request-form-help">${identity.requesterIntake.priceHelp}</p>
        </form>
      </section>
    `;
  }

  function renderRequesterHistory(historyNode) {
    if (!historyNode) {
      return;
    }

    if (!isRequesterMode()) {
      historyNode.hidden = true;
      historyNode.replaceChildren();
      return;
    }

    const employeeRequests = snackRequestsService.getRequestsByRequester(ACTING_USERS.sampleEmployee);

    historyNode.hidden = false;
    historyNode.innerHTML = `
      <section class="employee-requests" aria-labelledby="employee-requests-title">
        <div class="employee-requests-header">
          <p class="eyebrow">${identity.requesterHistory.eyebrow}</p>
          <h2 id="employee-requests-title">${identity.requesterHistory.title}</h2>
          <p>${identity.requesterHistory.context}</p>
        </div>
        ${employeeRequests.length > 0 ? renderRequesterHistoryTable(employeeRequests) : renderRequesterHistoryEmpty()}
      </section>
    `;
  }

  function renderRequesterHistoryEmpty() {
    return `
      <div class="employee-requests-empty">
        <strong>${identity.requesterHistory.emptyTitle}</strong>
        <span>${identity.requesterHistory.emptyContext}</span>
      </div>
    `;
  }

  function renderRequesterHistoryTable(requests) {
    return `
      <div class="employee-request-table-shell">
        <table class="employee-request-table">
          <caption>${identity.requesterHistory.caption}</caption>
          <thead>
            <tr>
              <th scope="col">${identity.requesterHistory.headers.request}</th>
              <th scope="col">${identity.requesterHistory.headers.snack}</th>
              <th scope="col">${identity.requesterHistory.headers.itemCost}</th>
              <th scope="col">${identity.requesterHistory.headers.status}</th>
              <th scope="col">${identity.requesterHistory.headers.requested}</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(renderRequesterHistoryRow).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderRequesterHistoryRow(request) {
    const status = escapeHtml(request.status);

    return `
      <tr>
        <th scope="row">
          <span class="request-id">${escapeHtml(request.id)}</span>
          <span class="request-note"><strong>${identity.rowCopy.noteLabel}:</strong> ${
            escapeHtml(request.notes || identity.rowCopy.noNotes)
          }</span>
        </th>
        <td>${escapeHtml(request.snack)}</td>
        <td>${formatCurrency(request.itemCost)}</td>
        <td><span class="status-badge status-${status}">${formatStatus(request.status)}</span></td>
        <td>
          <time datetime="${escapeHtml(request.requestedAt)}">${escapeHtml(request.requestedAt)}</time>
          <span class="request-age">${formatRequestAge(request.requestedAt)}</span>
        </td>
      </tr>
    `;
  }

  function renderPagination(paginationNode, requestPage) {
    if (!paginationNode) {
      return;
    }

    if (requestPage.totalRequests === 0) {
      paginationNode.innerHTML = `
        <div class="pagination-copy">
          <strong>${identity.pagination.title}</strong>
          <span>${identity.pagination.empty}</span>
        </div>
      `;
      return;
    }

    paginationNode.innerHTML = `
      <div class="pagination-copy">
        <strong>${identity.pagination.title}</strong>
        <span>${identity.pagination.rangeLabel(
          requestPage.startIndex + 1,
          requestPage.endIndex,
          requestPage.totalRequests,
        )}</span>
        <span>${identity.pagination.pageLabel(requestPage.currentPage, requestPage.pageCount)}</span>
      </div>
      <div class="pagination-actions">
        <button class="pagination-button" type="button" data-pagination-action="previous" ${
          requestPage.currentPage === 1 ? "disabled" : ""
        }>${identity.pagination.previous}</button>
        <button class="pagination-button" type="button" data-pagination-action="next" ${
          requestPage.currentPage === requestPage.pageCount ? "disabled" : ""
        }>${identity.pagination.next}</button>
      </div>
    `;
  }

  function renderRequestRows(listNode, requests) {
    if (requests.length === 0) {
      listNode.innerHTML = renderRequestRowsEmpty();
      return;
    }

    listNode.innerHTML = requests.map(renderRequestRow).join("");
  }

  function renderRequestRowsEmpty() {
    // Reuse the app's own empty-results treatment (see requester history).
    const context = isSearchActive()
      ? identity.search.emptyContext(searchTerm.trim())
      : identity.pagination.empty;

    return `
      <tr>
        <td colspan="7" class="request-empty-cell">
          <div class="employee-requests-empty">
            <strong>${escapeHtml(identity.search.emptyTitle)}</strong>
            <span>${escapeHtml(context)}</span>
          </div>
        </td>
      </tr>
    `;
  }

  function renderRequestRow(request) {
    const actionMarkup = renderActionMarkup(request);
    const status = escapeHtml(request.status);

    const notesMarkup = request.notes
      ? highlightMatch(request.notes)
      : escapeHtml(identity.rowCopy.noNotes);

    return `
      <tr>
        <th scope="row">
          <span class="request-id">${highlightMatch(request.id)}</span>
          <span class="request-note"><strong>${identity.rowCopy.noteLabel}:</strong> ${notesMarkup}</span>
        </th>
        <td>${highlightMatch(request.requester)}</td>
        <td>${highlightMatch(request.snack)}</td>
        <td>${formatCurrency(request.itemCost)}</td>
        <td><span class="status-badge status-${status}">${formatStatus(request.status)}</span></td>
        <td>
          <time datetime="${escapeHtml(request.requestedAt)}">${escapeHtml(request.requestedAt)}</time>
          <span class="request-age">${formatRequestAge(request.requestedAt)}</span>
        </td>
        <td>${actionMarkup}</td>
      </tr>
    `;
  }

  // Escape first, then wrap literal query occurrences in <mark>. Both sides are
  // HTML-escaped before matching, so the output stays injection-safe.
  function highlightMatch(rawValue) {
    const escaped = escapeHtml(rawValue);
    const query = searchTerm.trim();

    if (!query) {
      return escaped;
    }

    // Escape regex specials, then let any whitespace run in the query match any
    // whitespace run in the text — so highlighting stays consistent with matching.
    const pattern = escapeHtml(query)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");

    if (!pattern) {
      return escaped;
    }

    return escaped.replace(
      new RegExp(`(${pattern})`, "gi"),
      '<mark class="search-hit">$1</mark>',
    );
  }

  function renderActionMarkup(request) {
    if (request.status !== "pending") {
      return `<span class="muted-action">${identity.rowCopy.lockedAction}</span>`;
    }

    if (actingUser !== ACTING_USERS.administrator) {
      return `<span class="muted-action">${identity.rowCopy.requesterPendingAction}</span>`;
    }

    return `
      <button class="approve-button review-button" type="button" data-action="review" data-request-id="${escapeHtml(
        request.id,
      )}">${identity.rowCopy.reviewAction}</button>
    `;
  }

  function renderReviewModal(modalNode) {
    if (!activeReviewRequestId) {
      modalNode.hidden = true;
      modalNode.replaceChildren();
      return;
    }

    let request;

    try {
      request = snackRequestsService.getRequestById(activeReviewRequestId);
    } catch {
      activeReviewRequestId = null;
      modalNode.hidden = true;
      modalNode.replaceChildren();
      return;
    }

    modalNode.hidden = false;
    modalNode.innerHTML = `
      <div class="review-modal-backdrop" data-review-close></div>
      <section class="review-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" tabindex="-1">
        <div class="review-modal-header">
          <div>
            <p class="eyebrow">${identity.reviewModal.eyebrow}</p>
            <h2 id="review-modal-title">${escapeHtml(identity.reviewModal.title(request))}</h2>
          </div>
          <button class="modal-close-button" type="button" data-review-close aria-label="${
            identity.reviewModal.closeAction
          }">X</button>
        </div>
        <div class="review-modal-body">
          <div class="review-detail-panel">
            <h3>${identity.reviewModal.detailsTitle}</h3>
            <dl class="review-detail-list">
              ${renderReviewDetail(identity.reviewModal.fields.requester, request.requester)}
              ${renderReviewDetail(identity.reviewModal.fields.department, request.department)}
              ${renderReviewDetail(identity.reviewModal.fields.snack, request.snack)}
              ${renderReviewDetail(identity.reviewModal.fields.itemCost, formatCurrency(request.itemCost))}
              ${renderReviewDetail(identity.reviewModal.fields.status, formatStatus(request.status))}
              ${renderReviewDetail(identity.reviewModal.fields.requestedAt, request.requestedAt)}
              ${renderReviewDetail(
                identity.reviewModal.fields.notes,
                request.notes || identity.rowCopy.noNotes,
              )}
            </dl>
          </div>
          <div class="review-policy-slot" data-budget-warning-slot hidden></div>
        </div>
        <div class="review-modal-actions">
          <button class="reject-button" type="button" data-modal-action="reject">${identity.rowCopy.rejectAction}</button>
          <button class="approve-button" type="button" data-modal-action="approve">${identity.rowCopy.approveAction}</button>
        </div>
      </section>
    `;
  }

  function renderReviewDetail(label, value) {
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `;
  }

  function bindActingUserButtons() {
    root.querySelectorAll("[data-acting-user-value]").forEach((button) => {
      button.addEventListener("click", () => {
        actingUser = button.dataset.actingUserValue;
        requestDraft = {
          snackName: "",
          retailPrice: "",
          notes: "",
        };
        activeReviewRequestId = null;
        shouldFocusReviewModal = false;
        searchTerm = "";
        searchSort = null;
        searchCaret = null;
        currentPage = 1;
        notice =
          actingUser === ACTING_USERS.sampleEmployee
            ? { tone: "info", text: identity.notices.requester }
            : { tone: "info", text: identity.notices.initial };
        renderDashboard();
      });
    });
  }

  function bindActingUserDateOverride() {
    const todayOverride = root.querySelector("[data-today-override]");

    if (!todayOverride) {
      return;
    }

    todayOverride.addEventListener("change", (event) => {
      today = event.currentTarget.value || todayDefault();
      activeReviewRequestId = null;
      shouldFocusReviewModal = false;
      currentPage = 1;
      renderDashboard();
    });
  }

  function bindRequestForm() {
    const form = root.querySelector("[data-request-form]");

    if (!form) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const snackName = String(formData.get("snackName") || "").trim();
      const retailPriceValue = String(formData.get("retailPrice") || "");
      const retailPrice = Number(retailPriceValue);
      const notes = String(formData.get("notes") || "").trim();

      requestDraft = {
        snackName,
        retailPrice: retailPriceValue,
        notes,
      };

      if (!snackName) {
        notice = { tone: "warning", text: identity.requesterIntake.validation.snackRequired };
        renderDashboard();
        return;
      }

      if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
        notice = { tone: "warning", text: identity.requesterIntake.validation.priceRequired };
        renderDashboard();
        return;
      }

      if (retailPrice > REQUESTER_PRICE_CAP) {
        notice = { tone: "warning", text: identity.requesterIntake.validation.priceCap };
        renderDashboard();
        return;
      }

      const request = snackRequestsService.createRequest({
        requester: ACTING_USERS.sampleEmployee,
        department: identity.requesterIntake.department,
        snack: snackName,
        itemCost: roundCurrency(retailPrice),
        requestedAt: LOCAL_DEMO_REQUEST_DATE,
        notes: notes || undefined,
      });

      requestDraft = {
        snackName: "",
        retailPrice: "",
        notes: "",
      };
      activeReviewRequestId = null;
      currentPage = 1;
      notice = { tone: "success", text: identity.requesterIntake.created(request) };
      renderDashboard();
    });
  }

  function bindSearchControls() {
    const input = root.querySelector("[data-search-input]");

    if (input) {
      input.addEventListener("input", (event) => {
        searchTerm = event.currentTarget.value;
        searchCaret = event.currentTarget.selectionStart;
        currentPage = 1;
        activeReviewRequestId = null;
        shouldFocusReviewModal = false;
        shouldFocusSearch = true;
        renderDashboard();
      });
    }

    const clearButton = root.querySelector("[data-search-clear]");

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        searchTerm = "";
        searchCaret = null;
        currentPage = 1;
        activeReviewRequestId = null;
        shouldFocusReviewModal = false;
        shouldFocusSearch = true;
        renderDashboard();
      });
    }
  }

  function bindSortHeader() {
    const sortButton = root.querySelector("[data-sort='itemCost']");

    if (!sortButton) {
      return;
    }

    sortButton.addEventListener("click", () => {
      // Cycle: unsorted -> ascending -> descending -> unsorted.
      searchSort = searchSort === "asc" ? "desc" : searchSort === "desc" ? null : "asc";
      currentPage = 1;
      activeReviewRequestId = null;
      shouldFocusReviewModal = false;
      renderDashboard();
    });
  }

  function focusSearchIfRequested() {
    if (!shouldFocusSearch) {
      return;
    }

    shouldFocusSearch = false;

    const input = root.querySelector("[data-search-input]");

    if (!input) {
      return;
    }

    input.focus({ preventScroll: true });

    const caret = searchCaret == null ? input.value.length : Math.min(searchCaret, input.value.length);

    input.setSelectionRange(caret, caret);
  }

  function bindPaginationButtons() {
    root.querySelectorAll("[data-pagination-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.paginationAction === "previous") {
          currentPage -= 1;
        }

        if (button.dataset.paginationAction === "next") {
          currentPage += 1;
        }

        activeReviewRequestId = null;
        shouldFocusReviewModal = false;
        renderDashboard();
      });
    });
  }

  function bindReviewButtons() {
    root.querySelectorAll("[data-action='review']").forEach((button) => {
      button.addEventListener("click", () => {
        activeReviewRequestId = button.dataset.requestId;
        shouldFocusReviewModal = true;
        renderDashboard();
      });
    });
  }

  function bindReviewModalButtons() {
    const modal = root.querySelector(".review-modal-dialog");

    if (modal) {
      modal.addEventListener("keydown", trapReviewModalFocus);
    }

    root.querySelectorAll("[data-review-close]").forEach((button) => {
      button.addEventListener("click", () => {
        closeReviewModal();
      });
    });

    const approveButton = root.querySelector("[data-modal-action='approve']");
    const rejectButton = root.querySelector("[data-modal-action='reject']");

    if (approveButton) {
      approveButton.addEventListener("click", () => {
        const request = snackRequestsService.getRequestById(activeReviewRequestId);
        // Evaluate the memo as of the acting "effective snack date" so the rule
        // can be pointed at any day, and pass the full queue so the one-per-week
        // rule can see the requester's other approved snacks.
        const result = approveSnackRequest(request, {
          asOfDate: today,
          priorRequests: snackRequestsService.getRequests(),
        });

        activeReviewRequestId = null;
        shouldFocusReviewModal = false;

        if (result.ok) {
          snackRequestsService.updateRequestStatus(request.id, result.status);
          notice = { tone: "success", text: result.message };
        } else {
          // The request stays pending; surface *why* instead of silently doing
          // nothing (the old over-budget path vanished with no explanation).
          notice = { tone: "warning", text: result.message };
        }

        renderDashboard();
        focusAfterReviewClose(request.id);
      });
    }

    if (rejectButton) {
      rejectButton.addEventListener("click", () => {
        const request = snackRequestsService.getRequestById(activeReviewRequestId);

        snackRequestsService.updateRequestStatus(request.id, "rejected");
        activeReviewRequestId = null;
        shouldFocusReviewModal = false;
        notice = { tone: "warning", text: identity.notices.rejected(request) };
        renderDashboard();
        focusAfterReviewClose(request.id);
      });
    }
  }

  function closeReviewModal() {
    const requestId = activeReviewRequestId;

    activeReviewRequestId = null;
    shouldFocusReviewModal = false;
    renderDashboard();
    focusAfterReviewClose(requestId);
  }

  function focusReviewModalIfRequested() {
    if (!shouldFocusReviewModal) {
      return;
    }

    shouldFocusReviewModal = false;

    const modal = root.querySelector(".review-modal-dialog");

    if (modal) {
      modal.focus({ preventScroll: true });
    }
  }

  function focusAfterReviewClose(requestId) {
    const reviewButton = Array.from(root.querySelectorAll("[data-action='review']")).find(
      (button) => button.dataset.requestId === requestId,
    );

    if (reviewButton) {
      reviewButton.focus({ preventScroll: true });
      return;
    }

    const dashboardTitle = root.querySelector("#dashboard-title");

    if (dashboardTitle) {
      dashboardTitle.focus({ preventScroll: true });
    }
  }

  function trapReviewModalFocus(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeReviewModal();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const modal = event.currentTarget;
    const focusableElements = getFocusableElements(modal);

    if (focusableElements.length === 0) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  function getFocusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        !element.disabled &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.offsetParent !== null,
    );
  }

  renderDashboard();

  function isRequesterMode() {
    return actingUser === ACTING_USERS.sampleEmployee;
  }

  function formatStatus(status) {
    return escapeHtml(identity.statusLabels[status] || status);
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-US", {
      currency: "USD",
      style: "currency",
    });
  }

  function roundCurrency(value) {
    return Math.round(value * 100) / 100;
  }

  function setText(selector, text) {
    const node = root.querySelector(selector);

    if (node) {
      node.textContent = text;
    }
  }

  function appendTextWithOptionalLineBreak(node, text, lineBreakAfter) {
    if (!lineBreakAfter || !text.startsWith(lineBreakAfter)) {
      node.textContent = text;
      return;
    }

    const trailingText = text.slice(lineBreakAfter.length).trimStart();

    node.append(document.createTextNode(lineBreakAfter));
    node.append(document.createElement("br"));
    node.append(document.createTextNode(trailingText));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return replacements[character];
    });
  }
}
