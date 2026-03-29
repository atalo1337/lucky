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
}

export interface LotteryStatusResponse {
  isEnabled: boolean
  participantCount: number
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
}

export interface DashboardResponse {
  isEnabled: boolean
  participantCount: number
  winnerCount: number
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
  createdAt: string
  updatedAt: string
}

export interface DrawRecord {
  id: string
  createdAt: string
  isWin: boolean
  participantHash: string
  prizeName: string | null
  codeValue: string | null
  shownMessage: string
}

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}
