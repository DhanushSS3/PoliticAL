import { NestFactory } from "@nestjs/core";
import { Constants } from "./common/constants/constants"; // We need to create this later or remove if unused yet
import { AppModule } from "./app.module";
import * as cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all origins (temporary)
  app.enableCors({
    origin: true, // Reflect request origin
    credentials: true,
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix(Constants.API_PREFIX);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
