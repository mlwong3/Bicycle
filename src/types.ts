export type ReportStatus =
  | 'pending'
  | 'reviewing'
  | 'classified'
  | 'field_review_required'
  | 'notice_issued'
  | 'deadline_expired'
  | 'clearance_approved'
  | 'scheduled'
  | 'in_progress'
  | 'resolved'
  | 'needs_information'
  | 'duplicate'
  | 'dismissed';

export type CaseType =
  | 'obstruction'
  | 'illegal_parking'
  | 'suspected_abandoned'
  | 'damaged_bicycle'
  | 'safety_hazard'
  | 'duplicate'
  | 'insufficient_information'
  | 'other';

export type Urgency = 'emergency' | 'urgent' | 'normal';

export type DepartmentCode = 'HAD' | 'TD' | 'LandsD' | 'FEHD' | 'HKPF';

export type WorkOrderTaskType =
  | 'jurisdiction_review'
  | 'safety_response'
  | 'site_verification'
  | 'suspension_notice'
  | 'site_closure'
  | 'statutory_notice'
  | 'removal'
  | 'custody_disposal'
  | 'coordination_closeout';

export type WorkOrderStatus =
  | 'draft'
  | 'awaiting_acceptance'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'declined'
  | 'cancelled';

export interface EvidenceChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  note?: string;
}

export interface WorkOrderHistoryEntry {
  at: string;
  actorUid: string;
  action: 'created' | 'assigned' | 'accepted' | 'declined' | 'status_changed' | 'blocked' | 'reassigned' | 'route_assigned';
  fromStatus?: WorkOrderStatus;
  toStatus?: WorkOrderStatus;
  reason?: string;
}

export interface WorkOrder {
  id: string;
  caseId: string;
  jointOperationId?: string;
  taskType: WorkOrderTaskType;
  title: string;
  leadDepartment: DepartmentCode;
  supportingDepartments: DepartmentCode[];
  assignedTeamId?: string;
  assignedStaffUid?: string;
  location: string;
  district: string;
  scheduledAt?: string;
  dueAt?: string;
  executableAfter?: string;
  priority: Urgency;
  prerequisiteWorkOrderIds: string[];
  requiredCapabilities: string[];
  requiredEquipment: string[];
  evidenceChecklist: EvidenceChecklistItem[];
  status: WorkOrderStatus;
  blockerReason?: string;
  patrolRouteId?: string;
  assignmentHistory: WorkOrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  department: DepartmentCode;
  districts: string[];
  capabilities: string[];
  equipment: string[];
  onDuty: boolean;
  dailyCapacity: number;
  activeWorkload: number;
}

export interface JointOperation {
  id: string;
  title: string;
  location: string;
  district: string;
  actionDate: string;
  coordinatingDepartment: DepartmentCode;
  participatingDepartments: DepartmentCode[];
  mandatoryWorkOrderIds: string[];
  status: 'draft' | 'preparing' | 'ready' | 'in_progress' | 'completed' | 'postponed';
}

export interface DashboardFilters {
  district: 'all' | string;
  department: 'all' | DepartmentCode;
  date: string;
  status: 'all' | WorkOrderStatus;
}

export interface DepartmentLoad {
  awaitingAcceptance: number;
  scheduled: number;
  inProgress: number;
  blocked: number;
  completedToday: number;
}

export interface StatusHistoryEntry {
  status: ReportStatus;
  at: string;
  by: string;
  note?: string;
}

export interface ReportEvent {
  action: 'status_changed' | 'classification_updated' | 'rubric_completed'
    | 'procedure_confirmed' | 'route_assigned' | 'case_resolved';
  fromStatus?: ReportStatus;
  toStatus?: ReportStatus;
  actorUid: string;
  actorRole: 'admin' | 'field-staff' | 'system';
  note?: string;
  createdAt: string;
}

export interface RubricObservation {
  score: 0 | 1 | 2 | 3 | null;
  observable: boolean;
  note?: string;
}

export interface ManualRubric {
  rust: RubricObservation;
  tire: RubricObservation;
  dust: RubricObservation;
  attachment: RubricObservation;
  missing: RubricObservation;
  lock: RubricObservation;
}

export interface RubricSummary {
  observableCount: number;
  scoredCount: number;
  totalScore: number | null;
  maximumObservableScore: number;
  dataSufficiency: 'sufficient' | 'partial' | 'insufficient';
}

export interface ManualRubricRecord extends ManualRubric {
  completedBy: string;
  completedAt: string;
}

export interface ProcedureConfig {
  id: string;
  label: string;
  noticePeriodHours?: number;
  legalBasisNote?: string;
  responsibleDepartment?: string;
  completionCondition: 'field_confirmed' | 'deadline_expired' | 'manual_approval';
  defaultServiceMinutes: number;
  active: boolean;
}

export interface AiCaseClassification {
  caseType: CaseType;
  urgency: Urgency;
  obstructionLevel: 0 | 1 | 2 | 3;
  suggestedDepartment: string | null;
  missingInformation: string[];
  possibleDuplicateReportIds: string[];
  priorityBand: 'low' | 'medium' | 'high';
  rationale: string[];
  confidence: 'low' | 'medium' | 'high';
  source: 'ai-text-classification' | 'rule-fallback';
  suggestedAction: '建議現場覆核' | '建議補充資料' | '建議一般程序處理' | '建議交由負責部門再確認';
}

export interface AiClassificationInput {
  reportId: string;
  description: string;
  citizenTags: string[];
  locationLabel: string;
  hasCoordinates: boolean;
  manualRubricSummary?: {
    observedIndicators: string[];
    unobservableIndicators: string[];
  };
}

export interface PublicReport {
  id: string;
  reporterUid?: string;
  publicStatus: 'pending' | 'processing' | 'resolved' | 'dismissed';
  publicMessage?: string;
  submittedAt?: string;
  updatedAt?: string;
  locationLabel: string;
  imagePreviewPath?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type PatrolTravelMode = 'inspection-walking' | 'inspection-driving' | 'clearance-vehicle';
export type PatrolTaskGroup = 'verification' | 'notice' | 'removal';

export interface PatrolOptions {
  travelMode: PatrolTravelMode;
  taskGroup: PatrolTaskGroup;
  maxStops: number;
  serviceMinutesPerStop: number;
  routeSource?: 'mapbox' | 'leaflet-estimate' | 'straight-line-estimate';
}

export interface PatrolRouteDraft {
  workOrderIds: string[];
  orderedStops: Array<{
    workOrderId: string;
    caseId: string;
    order: number;
    priorityScore: number;
    estimatedServiceMinutes: number;
  }>;
  department: DepartmentCode;
  actionDate: string;
  taskGroup: PatrolTaskGroup;
  startPoint: Coordinates;
  travelMode: PatrolTravelMode;
  estimatedDistanceKm: number;
  initialDistanceKm: number;
  estimatedTravelMinutesRange: { min: number; max: number };
  algorithm: 'nearest-neighbor-2opt';
  routeSource: 'mapbox' | 'leaflet-estimate' | 'straight-line-estimate';
  status: 'draft';
}

export interface Bike {
  id: string;
  model: string;
  frameNo: string;
  ownerName: string;
  nfcBound: boolean;
  nfcTagId?: string;
}

export interface Report {
  id: string;
  reporterUid?: string;
  imageUrl?: string;
  location: string;
  lat?: number;
  lng?: number;
  description: string;
  status: ReportStatus;
  date: string;
  citizenTags?: string[];
  locationSource?: 'gps' | 'manual' | 'unknown';
  demoMode?: boolean;
  noticeDate?: string;
  statusHistory?: StatusHistoryEntry[];
  handledBy?: string;
  caseType?: CaseType;
  urgency?: Urgency;
  aiClassification?: AiCaseClassification;
  manualRubric?: ManualRubricRecord;
  procedureConfigSnapshot?: ProcedureConfig;
  deadlineAt?: string;
  procedureConfirmed?: boolean;
  coordinatesValid?: boolean;
  isDuplicate?: boolean;
  duplicateOf?: string;
  assignedDepartment?: string;
  assignedTeam?: string;
  patrolRouteId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminReport extends Report {
  locationSource: 'gps' | 'manual' | 'unknown';
  caseType: CaseType;
  urgency: Urgency;
  aiClassification?: AiCaseClassification;
  manualRubric?: ManualRubricRecord;
  procedureConfigSnapshot?: ProcedureConfig;
  deadlineAt?: string;
  procedureConfirmed: boolean;
  coordinatesValid: boolean;
  isDuplicate: boolean;
  duplicateOf?: string;
  assignedDepartment?: string;
  assignedTeam?: string;
  patrolRouteId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  events?: ReportEvent[];
}

export interface RecycleStation {
  id: string;
  name: string;
  distance: string;
  logoUrl: string;
  logoAlt: string;
  contactNo: string;
}

export interface EcoPartner {
  id: string;
  name: string;
  rating: number;
  description: string;
  distance: string;
  imageUrl: string;
  imageAlt: string;
  address: string;
  services: string[];
}

export interface ParkingSpot {
  id: string;
  name: string;
  distance: string;
  availableSlots: number;
  totalSlots: number;
  type: string;
  lat: number;
  lng: number;
}
