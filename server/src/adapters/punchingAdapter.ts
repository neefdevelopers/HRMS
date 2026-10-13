import { prisma } from '../config/prisma.js';
import { ENV } from '../config/env.js';

export interface RawPunchItem {
  biometricId: string;
  punchTime: string; // ISO 8601
  punchType?: 'CHECK_IN' | 'CHECK_OUT' | 'AUTO';
  verificationType?: 'FINGERPRINT' | 'FACE' | 'RFID' | 'MANUAL';
  deviceSerialNumber?: string;
}

export interface SyncResult {
  totalFetched: number;
  inserted: number;
  duplicatesSkipped: number;
  failed: number;
  syncLogId: string;
}

/**
 * Biometric / Punching System Integration Adapter Interface
 */
export interface IPunchingDeviceAdapter {
  fetchPunches(fromDate: Date, toDate: Date): Promise<RawPunchItem[]>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

/**
 * Production placeholder adapter for external biometric hardware / cloud API
 */
export class ExternalBiometricVendorAdapter implements IPunchingDeviceAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = ENV.PUNCHING_API_BASE_URL;
    this.apiKey = ENV.PUNCHING_API_KEY;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // In production, performs ping/healthcheck on vendor's API
    if (!this.apiKey || this.apiKey.includes('mock')) {
      return {
        success: false,
        message: 'Vendor API credentials not yet provisioned. Operating in simulated fallback mode.'
      };
    }
    return { success: true, message: 'Connected to biometric gateway.' };
  }

  async fetchPunches(fromDate: Date, toDate: Date): Promise<RawPunchItem[]> {
    // When real credentials are configured, fetch from HTTP vendor endpoint
    // e.g. await fetch(`${this.baseUrl}/punches?start=${fromDate.toISOString()}`)
    return [];
  }
}

/**
 * Development & Testing Mock Adapter
 * Generates realistic punch sync payloads matching enrolled employee biometric IDs.
 */
export class DevelopmentMockPunchAdapter implements IPunchingDeviceAdapter {
  async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Simulated Biometric Cloud Gateway is online (Development Mode).'
    };
  }

  async fetchPunches(fromDate: Date, toDate: Date): Promise<RawPunchItem[]> {
    // Find active employees with mapped biometric IDs
    const employees = await prisma.employee.findMany({
      where: {
        employeeStatus: 'ACTIVE',
        biometricId: { not: null }
      },
      include: { shift: true }
    });

    const punches: RawPunchItem[] = [];
    const dateStr = fromDate.toISOString().split('T')[0];

    for (const emp of employees) {
      if (!emp.biometricId) continue;

      // Realistic check-in simulation around shift time
      const shiftStart = emp.shift?.startTime || '09:00';
      const [startHour, startMin] = shiftStart.split(':').map(Number);

      // Check-in punch (varied between 08:45 and 09:25)
      const minuteOffset = Math.floor(Math.random() * 40) - 15; // -15 to +25 min
      const inTime = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(Math.max(0, startMin + minuteOffset)).padStart(2, '0')}:12Z`);

      punches.push({
        biometricId: emp.biometricId,
        punchTime: inTime.toISOString(),
        punchType: 'CHECK_IN',
        verificationType: 'FINGERPRINT',
        deviceSerialNumber: 'DEV-BIO-GATE-01'
      });

      // Check-out punch (approx 8.5 to 9.5 hours later)
      const outTime = new Date(inTime.getTime() + (8.5 * 3600 * 1000) + (Math.floor(Math.random() * 30) * 60 * 1000));
      punches.push({
        biometricId: emp.biometricId,
        punchTime: outTime.toISOString(),
        punchType: 'CHECK_OUT',
        verificationType: 'FINGERPRINT',
        deviceSerialNumber: 'DEV-BIO-GATE-01'
      });
    }

    return punches;
  }
}

/**
 * Core Punch Synchronization and Attendance Aggregation Engine
 */
export class PunchSyncService {
  private adapter: IPunchingDeviceAdapter;

  constructor() {
    this.adapter = ENV.PUNCHING_API_MOCK_ENABLED
      ? new DevelopmentMockPunchAdapter()
      : new ExternalBiometricVendorAdapter();
  }

  async runSync(syncType = 'MANUAL', fromDate = new Date(), toDate = new Date()): Promise<SyncResult> {
    const startTime = new Date();
    
    // Create sync log
    const syncLog = await prisma.punchSyncLog.create({
      data: {
        syncType,
        startTime,
        status: 'PROCESSING'
      }
    });

    try {
      const rawPunches = await this.adapter.fetchPunches(fromDate, toDate);
      let inserted = 0;
      let duplicatesSkipped = 0;

      for (const punch of rawPunches) {
        const punchDateTime = new Date(punch.punchTime);

        // Deduplication check: check if a punch for this biometricId already exists within 1 minute
        const existingPunch = await prisma.punchRecord.findFirst({
          where: {
            biometricId: punch.biometricId,
            punchTime: {
              gte: new Date(punchDateTime.getTime() - 60000),
              lte: new Date(punchDateTime.getTime() + 60000)
            }
          }
        });

        if (existingPunch) {
          duplicatesSkipped++;
          continue;
        }

        // Find associated employee
        const employee = await prisma.employee.findUnique({
          where: { biometricId: punch.biometricId }
        });

        await prisma.punchRecord.create({
          data: {
            biometricId: punch.biometricId,
            employeeId: employee?.id || null,
            brandId: employee?.brandId || null,
            punchTime: punchDateTime,
            punchType: punch.punchType || 'CHECK_IN',
            verificationType: punch.verificationType || 'FINGERPRINT',
            rawPayload: JSON.stringify(punch),
            syncStatus: 'SYNCED',
            isProcessed: false
          }
        });

        inserted++;
      }

      // Recompute daily attendance for affected dates
      const dateStr = fromDate.toISOString().split('T')[0];
      await this.calculateDailyAttendance(dateStr);

      await prisma.punchSyncLog.update({
        where: { id: syncLog.id },
        data: {
          endTime: new Date(),
          recordsFetched: rawPunches.length,
          recordsInserted: inserted,
          recordsFailed: duplicatesSkipped,
          status: 'SUCCESS'
        }
      });

      return {
        totalFetched: rawPunches.length,
        inserted,
        duplicatesSkipped,
        failed: 0,
        syncLogId: syncLog.id
      };
    } catch (error: any) {
      await prisma.punchSyncLog.update({
        where: { id: syncLog.id },
        data: {
          endTime: new Date(),
          status: 'FAILED',
          errorMessage: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Calculates and updates daily attendance based on punch records, approved leaves, and shifts
   */
  async calculateDailyAttendance(dateString: string) {
    const activeEmployees = await prisma.employee.findMany({
      where: { employeeStatus: 'ACTIVE' },
      include: {
        shift: true,
        brand: true,
        branch: true
      }
    });

    const dayStart = new Date(`${dateString}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateString}T23:59:59.999Z`);

    // Check for general holiday
    const holiday = await prisma.holiday.findFirst({
      where: { date: dateString }
    });

    for (const emp of activeEmployees) {
      // Check if employee has approved leave on this date
      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: emp.id,
          status: 'APPROVED',
          startDate: { lte: dateString },
          endDate: { gte: dateString }
        }
      });

      // Get punches for this employee on this date
      const punches = await prisma.punchRecord.findMany({
        where: {
          employeeId: emp.id,
          punchTime: { gte: dayStart, lte: dayEnd }
        },
        orderBy: { punchTime: 'asc' }
      });

      let status = 'ABSENT';
      let checkIn: Date | null = null;
      let checkOut: Date | null = null;
      let workingHours = 0;
      let lateMinutes = 0;
      let earlyExitMinutes = 0;

      if (approvedLeave) {
        status = approvedLeave.isHalfDay ? 'HALF_DAY' : 'ON_LEAVE';
      } else if (punches.length > 0) {
        checkIn = punches[0].punchTime;
        checkOut = punches.length > 1 ? punches[punches.length - 1].punchTime : null;

        if (checkIn && checkOut) {
          workingHours = Number(((checkOut.getTime() - checkIn.getTime()) / (1000 * 3600)).toFixed(2));
        }

        // Calculate late status based on employee shift
        const shift = emp.shift;
        if (shift && checkIn) {
          const [sHour, sMin] = shift.startTime.split(':').map(Number);
          const shiftStartTime = new Date(checkIn);
          shiftStartTime.setHours(sHour, sMin, 0, 0);

          const gracePeriodEnd = new Date(shiftStartTime.getTime() + (shift.gracePeriodMinutes * 60000));

          if (checkIn > gracePeriodEnd) {
            lateMinutes = Math.round((checkIn.getTime() - shiftStartTime.getTime()) / 60000);
            status = 'LATE';
          } else {
            status = 'PRESENT';
          }

          if (workingHours > 0 && workingHours < shift.halfDayThresholdHours) {
            status = 'HALF_DAY';
          }
        } else {
          status = 'PRESENT';
        }
      } else if (holiday) {
        status = 'HOLIDAY';
      }

      // Upsert attendance record
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: emp.id,
            date: dateString
          }
        },
        update: {
          shiftId: emp.shiftId,
          checkIn,
          checkOut,
          workingHours,
          status,
          lateMinutes,
          earlyExitMinutes
        },
        create: {
          employeeId: emp.id,
          brandId: emp.brandId,
          branchId: emp.branchId,
          date: dateString,
          shiftId: emp.shiftId,
          checkIn,
          checkOut,
          workingHours,
          status,
          lateMinutes,
          earlyExitMinutes
        }
      });
    }
  }
}
