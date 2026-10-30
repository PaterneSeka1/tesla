import { AccountSettings } from '@/components/accounts/account-settings';
import { PageHeading } from '@/components/page-heading';

export default function Page() {
  return (
    <>
      <PageHeading title="Mon compte" />
      <AccountSettings />
    </>
  );
}
