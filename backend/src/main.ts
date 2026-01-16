import { NestFactory } from "@nestjs/core";
import { Constants } from "./common/constants/constants"; // We need to create this later or remove if unused yet
import { AppModule } from "./app.module";
import * as cookieParser from "cookie-parser";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('HTTP');

  // Enable CORS for all origins (temporary)
  app.enableCors({
    origin: true, // Reflect request origin
    credentials: true,
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Request logging middleware
  app.use((req, res, next) => {
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';

    logger.log(`${method} ${originalUrl} - ${userAgent}`);

    next();
  });

  // Global prefix
  app.setGlobalPrefix(Constants.API_PREFIX);

  await app.listen(process.env.PORT || 3000);
  logger.log(`Application is running on: http://localhost:${process.env.PORT || 3000}`);
}
bootstrap();
