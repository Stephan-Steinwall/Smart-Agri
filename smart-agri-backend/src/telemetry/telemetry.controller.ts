import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  LoginDto,
  ResendOtpDto,
  SendSmsDto,
  UpdateAccountDto,
  UpdateSystemControlPasswordDto,
  VerifyAccountPasswordDto,
  VerifyOtpDto,
  VerifySystemControlDto,
} from './dto/auth.dto';
import { ToggleSwitchDto } from './dto/switches.dto';
import {
  DeleteAnalysisDto,
  SaveAnalysisDto,
  UpdateAnalysisEvaluationDto,
} from './dto/analysis.dto';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @UseGuards(AuthGuard)
  @Get('latest/:deviceId')
  getLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getLatestReading(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('history/:deviceId')
  getHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getHistoricalData(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('dashboard-history/:deviceId')
  getDashboardHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getDashboardHistory(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('environment/latest/:deviceId')
  getEnvironmentLatest(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentLatest(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('environment/history/:deviceId')
  getEnvironmentHistory(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getEnvironmentHistory(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('saved-analyses/:deviceId')
  async getSavedAnalyses(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getSavedAnalyses(deviceId);
  }

  @UseGuards(AuthGuard)
  @Post('save-analysis')
  async saveAnalysis(@Body() body: SaveAnalysisDto) {
    return this.telemetryService.saveAnalysis(body);
  }

  @UseGuards(AuthGuard)
  @Post('update-analysis-evaluation')
  async updateAnalysisEvaluation(@Body() body: UpdateAnalysisEvaluationDto) {
    return this.telemetryService.updateAnalysisEvaluation(body);
  }

  @UseGuards(AuthGuard)
  @Post('delete-analysis')
  async deleteAnalysis(@Body() body: DeleteAnalysisDto) {
    return this.telemetryService.deleteAnalysis(body);
  }

  @UseGuards(AuthGuard)
  @Get('pump-logs/:deviceId')
  async getPumpLogs(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getPumpLogs(deviceId);
  }

  @UseGuards(AuthGuard)
  @Get('system-switches/:deviceId')
  async getSystemSwitches(@Param('deviceId') deviceId: string) {
    return this.telemetryService.getSystemSwitches(deviceId);
  }

  @UseGuards(AuthGuard)
  @Post('system-switches/:deviceId/toggle')
  async toggleSystemSwitch(
    @Param('deviceId') deviceId: string,
    @Body() body: ToggleSwitchDto,
  ) {
    return this.telemetryService.toggleSystemSwitch(
      deviceId,
      body.pumpName,
      body.state,
    );
  }

  // ── Pre-session auth routes (no guard: these ARE how a session is obtained) ──

  @Post('auth/login')
  async login(@Body() body: LoginDto) {
    return this.telemetryService.login(body.username, body.password);
  }

  @Post('auth/send-sms')
  async sendSms(@Body() body: SendSmsDto) {
    return this.telemetryService.sendSms(body.phone, body.code, body.userEmail);
  }

  @Post('auth/verify-otp')
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.telemetryService.verifyOtp(body.emailOrUsername, body.code);
  }

  @Post('auth/resend-otp')
  async resendOtp(@Body() body: ResendOtpDto) {
    return this.telemetryService.resendOtp(body.emailOrUsername);
  }

  // ── Session-required account/security routes ──

  @UseGuards(AuthGuard)
  @Post('auth/update-account')
  async updateAccount(@Body() body: UpdateAccountDto) {
    return this.telemetryService.updateAccount(body);
  }

  @UseGuards(AuthGuard)
  @Post('auth/verify-system-control')
  async verifySystemControl(@Body() body: VerifySystemControlDto) {
    return this.telemetryService.verifySystemControlPassword(
      body.emailOrUsername,
      body.password,
    );
  }

  @UseGuards(AuthGuard)
  @Post('auth/verify-account-password')
  async verifyAccountPassword(@Body() body: VerifyAccountPasswordDto) {
    return this.telemetryService.verifyAccountPassword(
      body.emailOrUsername,
      body.accountPassword,
    );
  }

  @UseGuards(AuthGuard)
  @Post('auth/update-system-control-password')
  async updateSystemControlPassword(
    @Body() body: UpdateSystemControlPasswordDto,
  ) {
    return this.telemetryService.updateSystemControlPassword(
      body.emailOrUsername,
      body.accountPassword,
      body.oldSystemPassword,
      body.newSystemPassword,
    );
  }
}
