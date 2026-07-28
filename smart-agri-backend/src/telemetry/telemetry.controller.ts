import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('latest/:deviceId')
  getLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getLatestReading(deviceId);
  }

  @Get('history/:deviceId')
  getHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getHistoricalData(deviceId);
  }

  @Get('dashboard-history/:deviceId')
  getDashboardHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getDashboardHistory(deviceId);
  }

  @Get('environment/latest/:deviceId')
  getEnvironmentLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentLatest(deviceId);
  }

  @Get('environment/history/:deviceId')
  getEnvironmentHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentHistory(deviceId);
  }

  @Get('saved-analyses/:deviceId')
  async getSavedAnalyses(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getSavedAnalyses(deviceId);
  }

  @Post('save-analysis')
  async saveAnalysis(@Body() body: any) {
    return this.telemetryService.saveAnalysis(body);
  }

  @Post('update-analysis-evaluation')
  async updateAnalysisEvaluation(@Body() body: any) {
    return this.telemetryService.updateAnalysisEvaluation(body);
  }

  @Post('delete-analysis')
  async deleteAnalysis(@Body() body: any) {
    return this.telemetryService.deleteAnalysis(body);
  }

  @Get('pump-logs/:deviceId')
  async getPumpLogs(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getPumpLogs(deviceId);
  }

  @Get('system-switches/:deviceId')
  async getSystemSwitches(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getSystemSwitches(deviceId);
  }

  @Post('system-switches/:deviceId/toggle')
  async toggleSystemSwitch(
    @Param('deviceId') deviceId: string,
    @Body() body: { pumpName: string; state: boolean },
  ) {
    return this.telemetryService.toggleSystemSwitch(deviceId, body.pumpName, body.state);
  }

  @Post('auth/login')
  async login(@Body() body: { username: string; password?: string }) {
    return this.telemetryService.login(body.username, body.password);
  }

  @Post('auth/send-sms')
  async sendSms(@Body() body: { phone: string; code: string; userEmail?: string }) {
    return this.telemetryService.sendSms(body.phone, body.code, body.userEmail);
  }

  @Post('auth/verify-otp')
  async verifyOtp(@Body() body: { emailOrUsername: string; code: string }) {
    return this.telemetryService.verifyOtp(body.emailOrUsername, body.code);
  }

  @Post('auth/resend-otp')
  async resendOtp(@Body() body: { emailOrUsername: string }) {
    return this.telemetryService.resendOtp(body.emailOrUsername);
  }

  @Post('auth/update-account')
  async updateAccount(@Body() body: { email?: string; oldEmail?: string; fullName?: string; username?: string; phone?: string }) {
    return this.telemetryService.updateAccount(body);
  }

  @Post('auth/verify-system-control')
  async verifySystemControl(@Body() body: { emailOrUsername: string; password?: string }) {
    return this.telemetryService.verifySystemControlPassword(body.emailOrUsername, body.password);
  }

  @Post('auth/verify-account-password')
  async verifyAccountPassword(@Body() body: { emailOrUsername: string; accountPassword?: string }) {
    return this.telemetryService.verifyAccountPassword(body.emailOrUsername, body.accountPassword);
  }

  @Post('auth/update-system-control-password')
  async updateSystemControlPassword(@Body() body: { emailOrUsername: string; accountPassword?: string; oldSystemPassword?: string; newSystemPassword?: string }) {
    return this.telemetryService.updateSystemControlPassword(body.emailOrUsername, body.accountPassword, body.oldSystemPassword, body.newSystemPassword);
  }
}



