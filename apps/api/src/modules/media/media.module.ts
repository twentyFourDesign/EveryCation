import { Controller, Global, Module, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../../common/auth.guard.js';
import { DiskStorage, MediaService, MediaStorage } from './media.service.js';

@ApiTags('media') @ApiBearerAuth()
@Controller('media')
class MediaController {
  constructor(private readonly media: MediaService) {}
  /** Upload one file in a multipart field called "file". Returns the id to attach to a tip. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) @ApiConsumes('multipart/form-data')
  @Post() @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file?: { buffer: Buffer; mimetype: string; size: number }) { return this.media.upload(u.id, file); }
}

@Global()
@Module({ controllers: [MediaController], providers: [MediaService, DiskStorage, { provide: MediaStorage, useExisting: DiskStorage }], exports: [MediaService, DiskStorage] })
export class MediaModule {}
