import { Text } from "@react-three/drei";

import type { ExhibitRendererProps } from "../exhibitRegistry";

export function TextExhibit({ item, isSelected }: ExhibitRendererProps) {
  const normalizedContent = item.content || " ";
  const lines = normalizedContent.split("\n");
  const lineCount = Math.max(1, lines.length);
  const maxChars = Math.max(...lines.map((line) => line.length), 1);
  const fontFamily = item.textFontFamily || "sans";
  const color = item.textColor || "#111827";
  const fontSize = item.textFontSize ?? 0.5;
  const isBold = Boolean(item.textIsBold);
  const backboardEnabled = Boolean(item.textBackboardEnabled);
  const backboardColor = item.textBackboardColor || "#ffffff";
  const fontWeight = isBold ? 800 : 400;
  const letterSpacing = fontFamily === "mono" ? 0.01 : 0.02;
  const charWidthFactor = isBold ? 1.02 : 0.92;
  const horizontalPadding = 0.5;
  const verticalPadding = 0.35;
  const boardWidth = maxChars * fontSize * charWidthFactor + horizontalPadding;
  const boardHeight = Math.max(0.6, lineCount * fontSize * 1.35 + verticalPadding);

  return (
    <group>
      {backboardEnabled && (
        <mesh position={[0, 0, -0.04]} castShadow receiveShadow>
          <planeGeometry args={[boardWidth, boardHeight]} />
          <meshStandardMaterial color={backboardColor} roughness={0.75} metalness={0.04} />
        </mesh>
      )}
      <Text
        color={color}
        fontSize={fontSize}
        maxWidth={Math.max(3, boardWidth * 0.9)}
        lineHeight={1}
        letterSpacing={letterSpacing}
        fontWeight={fontWeight}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {normalizedContent}
      </Text>
      {isSelected && (
        <mesh position={[0, 0, -0.1]}>
          <planeGeometry args={[boardWidth, boardHeight]} />
          <meshBasicMaterial color="#4f46e5" wireframe />
        </mesh>
      )}
    </group>
  );
}
