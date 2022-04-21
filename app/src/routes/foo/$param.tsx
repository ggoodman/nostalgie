import { useParams } from 'react-router';

export default function () {
  const params = useParams();

  return <h1>Got some params! {JSON.stringify(params)}</h1>;
}
