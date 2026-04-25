import { Get, Controller, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard, Public } from './common/guards/auth.guard';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags()
@Controller()
@UseGuards(JwtAuthGuard)
export class AppController {
  @Public()
  @Get('status')
  getHello() {
    return 'Hello World!';
  }

  @Public()
  @Get('docs')
  getDocs(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>API Docs</title>
        <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
        <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">

        <style>
          html, body {
            height: 100%;
            margin: 0;
            overflow: hidden; /* 🔥 stops page scroll */
          }

          elements-api {
            height: 100vh; /* full screen */
            display: block;
          }
        </style>
      </head>

      <body>
        <elements-api
          apiDescriptionUrl="https://anaerobic-finalize-geiger.ngrok-free.dev/api/v1/docs-json"
          router="hash"
          layout="sidebar"
        />
      </body>
      </html>
    `);
  }
}
