import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountSelfController } from './account-self.controller.js';
import { AccountMailer } from './account-mailer.js';
import { AccountSelfService } from './account-self.service.js';
import { OfflineDevicesController } from './offline-devices.controller.js';
import { OfflineDevicesService } from './offline-devices.service.js';
import { AccountsService } from './accounts.service.js';
import { UsersController } from './users.controller.js';

/**
 * Comptes : création par une personne habilitée, liens et codes d'activation et de réinitialisation,
 * « mot de passe oublié », envoi SMTP facultatif, désactivation, sessions ; compte personnel (mot de passe, profil, sessions).
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController, AccountSelfController, OfflineDevicesController],
  providers: [AccountsService, AccountSelfService, AccountMailer, OfflineDevicesService],
  exports: [AccountsService],
})
export class UsersModule {}
