import {
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
} from '@nestjs/common/pipes';
import {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MIME_PATTERN,
} from '../constants/upload-dirs.constant';

export const optionalImageFilePipe = new ParseFilePipe({
  fileIsRequired: false,
  validators: [
    new MaxFileSizeValidator({ maxSize: IMAGE_UPLOAD_MAX_BYTES }),
    new FileTypeValidator({
      fileType: IMAGE_UPLOAD_MIME_PATTERN,
    }),
  ],
});
