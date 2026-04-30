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
  getStatus() {
    const now = new Date();

    return {
      status: 'ok',
      message: 'Server is running 🚀',

      time: {
        iso: now.toISOString(),
        local: now.toLocaleString(),
        timestamp: now.getTime(),
      },

      uptime: {
        seconds: Math.floor(process.uptime()),
        human: this.formatUptime(process.uptime()),
      },

      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
      },

      env: process.env.NODE_ENV || 'development',
    };
  }

  private formatUptime(seconds: number) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hrs}h ${mins}m ${secs}s`;
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
      // https://pos-be-ukhw.onrender.com/
      <!--  https://anaerobic-finalize-geiger.ngrok-free.dev/api/v1/docs-json -->
      <!--  http://localhost:5000/api/v1/docs-json -->
      <body>
        <elements-api
          apiDescriptionUrl="https://pos-be-ukhw.onrender.com/api/v1/docs-json"
          router="hash"
          layout="sidebar"
        />
      </body>
      </html>
    `);
  }
}
