import { User, CreditCard, Plus, CheckCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import LoanDetailsSection from "./LoanDetailsSection";
import DemandSummaryTable from "./DemandSummaryTable";
import AttendanceSection from "./AttendanceSection";
import AmountBreakupForm from "./AmountBreakupForm";
import PaymentModeSection from "./PaymentModeSection";

export default function MemberRecoveryForm({
  currentMember,
  currentMemberSummary,
  isAlreadyRecovered,
  currentMemberRecoveryStatus,
  attendance,
  recoveryByOther,
  otherMemberId,
  allMembers,
  amountBreakup,
  totalAmount,
  autoCalculated,
  paymentMode,
  selectedBankId,
  onlineRef,
  screenshot,
  groupBanks,
  memberLoanTotals,
  loanDetails,
  showLoanBreakdown,
  currentMemberIndex,
  allMembersLength,
  onFullLoanRecoveryClick,
  onCreateFDClick,
  onToggleLoanBreakdown,
  onAttendanceChange,
  onRecoveryByOtherChange,
  onOtherMemberIdChange,
  onTotalAmountChange,
  onAmountChange,
  onAmountBreakupChange,
  onSetAutoCalculated,
  onPaymentModeChange,
  onBankIdChange,
  onOnlineRefChange,
  onFileUpload,
  onPrevious,
  onSaveRecovery,
  onResetForm,
}) {
  if (!currentMember || !currentMemberSummary) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-5 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2 truncate">
            <User size={20} className="text-blue-600 shrink-0 w-5 h-5" />
            <span className="truncate">{currentMember.name} ({currentMember.code})</span>
          </h3>
          {(() => {
            const fh = (currentMember.raw && (currentMember.raw.F_H_Name || currentMember.raw.F_H_FatherName)) || currentMember.fatherOrHusbandName || "";
            const fhStr = (typeof fh === "string" ? fh : String(fh || "")).trim();
            return fhStr ? (
              <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate" title="Father/Husband name helps identify members with the same name">
                Father/Husband: {fhStr}
              </p>
            ) : null;
          })()}
        </div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const currentLoanTotals = currentMember ? memberLoanTotals[currentMember.id] : null;
            const hasRemainingLoan = currentLoanTotals && (currentLoanTotals.remainingLoanAmount ?? 0) > 0;
            return hasRemainingLoan && onFullLoanRecoveryClick ? (
              <button
                onClick={onFullLoanRecoveryClick}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-xs sm:text-sm shadow-md transition-colors"
              >
                <CreditCard size={16} className="shrink-0" />
                <span className="whitespace-nowrap">Full Loan Recovery</span>
              </button>
            ) : null;
          })()}
          <button
            onClick={onCreateFDClick}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-xs sm:text-sm shadow-md"
          >
            <Plus size={16} className="shrink-0" />
            Create FD
          </button>
        </div>
      </div>

      {/* Show message if already recovered */}
      {isAlreadyRecovered && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle className="text-blue-600 shrink-0" size={20} />
            <p className="text-xs sm:text-sm text-blue-800 font-medium">
              Demand for this member has already been recovered today.
              {currentMemberRecoveryStatus?.recovery?.total && (
                <span className="ml-0 sm:ml-2 mt-1 sm:mt-0 inline-block">
                  Amount: ₹{Math.round(currentMemberRecoveryStatus.recovery.total).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Loan Details Section */}
      <LoanDetailsSection
        currentMember={currentMember}
        memberLoanTotals={memberLoanTotals}
        loanDetails={loanDetails}
        showLoanBreakdown={showLoanBreakdown}
        onToggleBreakdown={onToggleLoanBreakdown}
        onFullLoanRecovery={onFullLoanRecoveryClick}
      />

      {/* Demand Summary Table (with member basic details above) */}
      <DemandSummaryTable currentMember={currentMember} currentMemberSummary={currentMemberSummary} />

      {/* Attendance Section */}
      <AttendanceSection
        attendance={attendance}
        recoveryByOther={recoveryByOther}
        otherMemberId={otherMemberId}
        allMembers={allMembers}
        currentMember={currentMember}
        onAttendanceChange={onAttendanceChange}
        onRecoveryByOtherChange={onRecoveryByOtherChange}
        onOtherMemberIdChange={onOtherMemberIdChange}
      />

      {/* Amount Breakup - Only show if present or absent with recovery by other */}
      {(attendance === "present" || (attendance === "absent" && recoveryByOther)) && !isAlreadyRecovered && (
        <>
          <AmountBreakupForm
            amountBreakup={amountBreakup}
            totalAmount={totalAmount}
            autoCalculated={autoCalculated}
            currentMemberSummary={currentMemberSummary}
            currentMember={currentMember}
            memberLoanTotals={memberLoanTotals}
            onTotalAmountChange={onTotalAmountChange}
            onAmountChange={onAmountChange}
            onAmountBreakupChange={onAmountBreakupChange}
            onSetAutoCalculated={onSetAutoCalculated}
          />

          <PaymentModeSection
            paymentMode={paymentMode}
            selectedBankId={selectedBankId}
            onlineRef={onlineRef}
            screenshot={screenshot}
            groupBanks={groupBanks}
            onPaymentModeChange={onPaymentModeChange}
            onBankIdChange={onBankIdChange}
            onOnlineRefChange={onOnlineRefChange}
            onFileUpload={onFileUpload}
          />
        </>
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 sm:gap-4">
        <button
          onClick={onPrevious}
          disabled={currentMemberIndex === 0}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
        >
          <ArrowLeft size={18} className="shrink-0" />
          Previous
        </button>
        <button
          onClick={onSaveRecovery}
          disabled={isAlreadyRecovered}
          className={`flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 font-semibold shadow-md text-sm sm:text-base w-full sm:w-auto ${isAlreadyRecovered
            ? "bg-gray-400 text-white cursor-not-allowed opacity-60"
            : "bg-green-600 text-white hover:bg-green-700"
            }`}
        >
          {isAlreadyRecovered ? (
            <>
              Recovered Today
              <CheckCircle size={18} className="shrink-0" />
            </>
          ) : currentMemberIndex < allMembersLength - 1 ? (
            <>
              Save & Next
              <ArrowRight size={18} className="shrink-0" />
            </>
          ) : (
            <>
              Save & Finish
              <Check size={18} className="shrink-0" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
