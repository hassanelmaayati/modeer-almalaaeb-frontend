import Icon from '../common/Icon';
import useTheme from '../../lib/helpers/useTheme';

export default function ThemeToggle() {
  const { dark, toggleTheme } = useTheme();
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={dark}
    title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>
    <Icon name={dark ? 'moon' : 'sun'} size={22} />
  </button>;
}
