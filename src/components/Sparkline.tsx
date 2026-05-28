type SparklineProps = {
  path: string;
};

export function Sparkline({ path }: SparklineProps) {
  return (
    <svg className="spark" viewBox="0 0 340 58" preserveAspectRatio="none" aria-hidden="true">
      <path className="spark-grid" d="M0 14H340M0 34H340M0 54H340" />
      <path className="spark-fill" d={`${path} V58 H0 Z`} />
      <path className="spark-line" d={path} />
    </svg>
  );
}
