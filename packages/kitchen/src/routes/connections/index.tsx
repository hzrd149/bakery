import SimpleLayout from "../../components/simple-layout";

export default function Connections() {
  return (
    <SimpleLayout
      title="Connections"
      actions={
        <button class="btn btn-primary ms-auto" disabled>
          Add Connection
        </button>
      }
    >
      <div class="flex items-center justify-center min-h-[50vh]">
        <p class="text-base-content/60">No Connections</p>
      </div>
    </SimpleLayout>
  );
}
