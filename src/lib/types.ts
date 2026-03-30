export interface DrawResult {
  isWin: boolean
  prizeId: string | null
  prizeName: string | null
  message: string
  codeValue: string | null
  createdAt: string
}

export interface PublicPrize {
  id: string
  name: string
  winnerCount: number
}

export interface LotteryStatusResponse {
  isEnabled: boolean
  participantCount: number
  maxParticipants: number | null
  remainingParticipants: number | null
  siteKey: string
  hasParticipated: boolean
  lastResult: DrawResult | null
  publicPrizes: PublicPrize[]
}

export interface AdminMeResponse {
  username: string
  mustChangePassword: boolean
  lastLoginAt: string | null
}

export interface DashboardPrizeSummary {
  id: string
  name: string
  probabilityPercent: number
  isActive: boolean
  sortOrder: number
  availableCodes: number
  usedCodes: number
  winnerCount: number
}

export interface DashboardResponse {
  isEnabled: boolean
  maxParticipants: number | null
  scheduledOpenAt: string | null
  participantCount: number
  winnerCount: number
  remainingParticipants: number | null
  prizeSummaries: DashboardPrizeSummary[]
}

export interface AdminPrize {
  id: string
  name: string
  probabilityPercent: number
  winMessage: string
  isActive: boolean
  sortOrder: number
  availableCodes: number
  usedCodes: number
  winnerCount: number
  createdAt: string
  updatedAt: string
}

export interface PrizeCode {
  id: string
  codeValue: string
  status: 'unused' | 'used'
  importBatch: string
  createdAt: string
  usedAt: string | null
}

export interface DrawRecord {
  id: string
  createdAt: string
  isWin: boolean
  prizeName: string | null
  codeValue: string | null
  contactEmail: string | null
  emailStatus: string
  shownMessage: string
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}
