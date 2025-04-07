import SimpleLayout from "../../components/simple-layout";
import ConnectionsCard from "./components/connections-card";

function HomeView() {
  return (
    <SimpleLayout title="Bakery">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConnectionsCard class="max-h-[80dvh] lg:max-h-[50dvh] overflow-hidden flex flex-col" />
      </div>
    </SimpleLayout>
  );
}

export default HomeView;
