const React = require('react');
const ReactDOMServer = require('react-dom/server');

class Catcher extends React.Component {
  constructor() {
    super();
    this.state = {
      caught: false,
    };
  }
  componentDidCatch(err) {
    console.log('caught', err);
    this.setState({ caught: true });
  }
  render() {
    return this.state.caught ? 'OOPS' : this.props.children;
  }
}

function Suspender() {
  throw Promise.resolve('yolo');
}

const model = React.createElement(
  React.Suspense,
  { fallback: React.createElement('boom') },
  React.createElement(Suspender)
);

try {
  console.log('first', ReactDOMServer.renderToString(model));
} catch (err) {
  console.log('second', ReactDOMServer.renderToString(model));
}
