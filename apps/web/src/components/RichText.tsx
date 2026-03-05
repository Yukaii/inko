import type { CSSProperties } from "react";

type RichTextProps = {
  html?: string;
  text?: string;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
};

export function RichText({ html, text, className, style, placeholder = "-" }: RichTextProps) {
  if (html?.trim()) {
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <div className={className} style={style}>{text?.trim() ? text : placeholder}</div>;
}
