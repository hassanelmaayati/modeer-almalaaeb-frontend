import Field from '../common/Field';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';

export default function RegistrationDeadline({ defaultValue }) {
  // Times are entered in Bahrain time, like room schedules; CupForm converts them to UTC ISO.
  return <Field label="Registration closes (Bahrain time, optional)">
    <input name="registration_closes_at" type="datetime-local" defaultValue={toBahrainDateTimeInput(defaultValue)} />
  </Field>;
}
