interface OrderDetailPageProperties {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProperties): Promise<React.JSX.Element> {
  const { id } = await params;

  return (
    <main>
      <h1>Order {id}</h1>
      <p>Authenticated order detail placeholder.</p>
    </main>
  );
}
