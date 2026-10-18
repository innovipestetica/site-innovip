import Image from "next/image";
import logo from "../../../public/brand/innovip-logo.webp";

type LogoProps = {
  size?: number;
  priority?: boolean;
  className?: string;
};

export function Logo({ size = 96, priority = false, className }: LogoProps) {
  return (
    <Image
      src={logo}
      alt="Innovip — clínica de estética"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
