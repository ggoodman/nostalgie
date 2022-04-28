import { useMarkup } from 'nostalgie/markup';
import { Heading } from '../design/Heading';
import { Text } from '../design/Text';

export default function NotFound() {
  useMarkup({
    title: 'Nostalgie - Page Not Found',
  });

  return (
    <>
      <Heading size="xl" as="h1">
        404 - Lost in the Wash
      </Heading>
      <Text size="xl" as="p">
        If this page was supposed to be here, please check the lint trap.
      </Text>
    </>
  );
}
