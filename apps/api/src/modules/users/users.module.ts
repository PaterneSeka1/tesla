import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountSelfController } from './account-self.controller.js';
import { AccountSelfService } from './account-self.service.js';
import { AccountsService } from './accounts.service.js';
import { UsersController } from './users.controller.js';

/**
 * Comptes : création par une personne habilitée, liens d'activation et de réinitialisation,
 * désactivation, sessions ; compte personnel (mot de passe, profil, sessions).
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController, AccountSelfController],
  providers: [AccountsService, AccountSelfService],
  exports: [AccountsService],
})
export class UsersModule {}
