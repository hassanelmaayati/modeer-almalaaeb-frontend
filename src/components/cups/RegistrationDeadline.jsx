import Field from '../common/Field';
import { toBahrainDateTimeInput } from '../../lib/helpers/date';
import DateTimeInput from '../common/DateTimeInput';

export default function RegistrationDeadline({ defaultValue }) {
  // Times are entered in Bahrain time, like room schedules; CupForm converts them to UTC ISO.
  return <Field label="Registration closes (Bahrain time, optional)">
    <DateTimeInput name="registration_closes_at"  defaultValue={toBahrainDateTimeInput(defaultValue)} />
  </Field>;
}
