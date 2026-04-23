import logo from '../../assets/mentorix-logo.png'

const imgBase = 'object-contain select-none bg-transparent shrink-0'
const onDarkBoost =
  'drop-shadow-[0_6px_18px_rgba(34,224,136,0.25)] brightness-[1.12] saturate-[1.12]'

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login
}) {
  if (size === 'login') {
    return (
      <div className={`flex flex-col items-center justify-center min-w-0 ${className}`}>
        <img
          src={logo}
        