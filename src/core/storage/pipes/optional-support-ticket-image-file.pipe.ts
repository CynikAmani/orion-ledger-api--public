import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import {
  IMAGE_UPLOAD_MAX_BYTES,
  SUPPORT_TICKET_IMAGE_MIME_PATTERN,
} from '../constants/upload-dirs.constant';

export const optionalSupportTicketImageFilePipe = new ParseFilePipe({
  fileIsRequired: false,
  validators: [
    new MaxFileSizeValidator({ maxSize: IMAGE_UPLOAD_MAX_BYTES }),
    new FileTypeValidator({
      fileType: SUPPORT_TICKET_IMAGE_MIME_PATTERN,
    }),
  ],
});
