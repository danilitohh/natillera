export type NatilleraStatus = "active" | "finished" | "settled";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type LoanStatus = "active" | "paid" | "overdue" | "refinanced";
export type SettlementStatus = "pending" | "paid" | "debt" | "liquidated";
export type CashMovementType = "income" | "expense";
export type CashMovementCategory =
  | "contribution"
  | "raffle"
  | "lunch"
  | "trip_fund"
  | "late_interest"
  | "loan_disbursement"
  | "loan_payment"
  | "loan_interest"
  | "raffle_payout"
  | "adjustment"
  | "settlement";
export type AlertSeverity = "success" | "warning" | "critical";

export interface Settings {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  estimatedSettlementDate: string;
  status: NatilleraStatus;
  updatedAt: string;
}

export interface Participant {
  id: string;
  fullName: string;
  phone?: string;
  document?: string;
  joinedAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyContribution {
  id: string;
  participantId: string;
  month: number;
  year: number;
  quotaAmount: number;
  amountPaid: number;
  lateInterestPaid: number;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RaffleEntry {
  id: string;
  participantId: string;
  month: number;
  year: number;
  selectedNumber: number;
  fixedAmount: number;
  amountPaid: number;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RaffleRound {
  id: string;
  month: number;
  year: number;
  winnerParticipantId?: string;
  winningNumber?: number;
  drawDate?: string;
  payoutRecordedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LunchContribution {
  id: string;
  participantId: string;
  month: number;
  year: number;
  fixedAmount: number;
  amountPaid: number;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripContribution {
  id: string;
  participantId: string;
  month: number;
  year: number;
  quotaAmount: number;
  amountPaid: number;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  participantId: string;
  principalAmount: number;
  issuedAt: string;
  installmentCount: number;
  monthlyInterestRate: number;
  status: LoanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  capitalAmount: number;
  interestAmount: number;
  totalAmount: number;
  amountPaid: number;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashAdjustment {
  id: string;
  date: string;
  type: CashMovementType;
  category: "adjustment" | "settlement";
  amount: number;
  description: string;
  participantId?: string;
  createdBy: string;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  participantId: string;
  generatedAt: string;
  individualSavings: number;
  commonFundShare: number;
  outstandingDebt: number;
  finalAmount: number;
  status: SettlementStatus;
  paidAt?: string;
  notes?: string;
  updatedAt: string;
}

export interface Database {
  version: number;
  settings: Settings;
  participants: Participant[];
  monthlyContributions: MonthlyContribution[];
  raffleEntries: RaffleEntry[];
  raffleRounds: RaffleRound[];
  lunches: LunchContribution[];
  tripContributions: TripContribution[];
  loans: Loan[];
  loanInstallments: LoanInstallment[];
  cashAdjustments: CashAdjustment[];
  settlements: SettlementRecord[];
  updatedAt: string;
}

export interface GeneratedCashMovement {
  id: string;
  date: string;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
  participantId?: string;
  sourceId: string;
  createdBy: string;
}

export interface AlertRecord {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  participantId?: string;
  href?: string;
}

export interface ContributionSnapshot {
  record: MonthlyContribution;
  status: PaymentStatus;
  lateInterestDue: number;
  baseOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
}

export interface FixedContributionSnapshot<TRecord> {
  record: TRecord;
  status: PaymentStatus;
  baseOutstanding: number;
}

export interface LoanInstallmentSnapshot {
  installment: LoanInstallment;
  status: PaymentStatus;
  capitalPaid: number;
  interestPaid: number;
  capitalOutstanding: number;
  interestOutstanding: number;
  totalOutstanding: number;
}

export interface LoanSnapshot {
  loan: Loan;
  installments: LoanInstallmentSnapshot[];
  totalPaid: number;
  totalInterestGenerated: number;
  totalInterestPaid: number;
  principalOutstanding: number;
  totalOutstanding: number;
  overdueInstallments: number;
  status: LoanStatus;
}

export interface DashboardMetrics {
  availableCash: number;
  grossCashPool: number;
  movementCashBalance: number;
  totalContributionCollected: number;
  totalRaffleCollected: number;
  totalRaffleBalance: number;
  totalRafflePayouts: number;
  totalLunchCollected: number;
  totalLunchExtraSales: number;
  totalLunchCombined: number;
  totalTripCollected: number;
  totalLateInterestCollected: number;
  totalLoanInterestCollected: number;
  totalLoanedOut: number;
  totalPendingToCollect: number;
  totalCommonFund: number;
  totalCashIn: number;
  totalCashOut: number;
}

export interface ParticipantSummary {
  participant: Participant;
  totalContributions: number;
  totalRaffles: number;
  totalLunches: number;
  totalTripSavings: number;
  totalLateInterests: number;
  activeLoans: number;
  pendingDebt: number;
  estimatedSettlement: number;
  commonFundShare: number;
}

export interface SettlementPreview {
  participant: Participant;
  individualSavings: number;
  commonFundShare: number;
  outstandingDebt: number;
  finalAmount: number;
  status: SettlementStatus;
  paidAt?: string;
}

export interface AdminSessionPayload {
  username: string;
  issuedAt: string;
}
