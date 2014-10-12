/** @jsx React.DOM */
/**
 * TODO
 * - RWD
 */
var ADD_CELL_INTERVAL_SECONDS = 6;
var WAIT_CELL_TIMEOUT_SECONDS = 5;
var TAP_CELL_TIMEOUT_SECONDS = 3;
var CELL_WAIT = "wait";
var CELL_TAP = "tap";
var CELL_DONE = "done";
var CELL_DEAD = "dead";

function range(n) {
  return Array.apply(0, Array(n)).map(function (_, i) {
    return i;
  });
}

function slice(list) {
  return [].slice.apply(list, [].slice.call(arguments, 1));
}

function replaceAt(list, index, value) {
  // hint: splice sucks balls.
  var start = slice(list, 0, index);
  var end = slice(list, index + 1, list.length);
  return start.concat({type: CELL_WAIT}, end);
}

var store = (function() {
  var _cells = [], _changeListeners = [];

  function _findOffIndexes() {
    return _cells.reduce(function(indexes, cell, i) {
      return cell.type === "off" ? indexes.concat(i) : indexes;
    }, []);
  }

  function _setCells(cells) {
    _cells = cells;
    _changeListeners.forEach(function(listener) {
      listener();
    });
  }

  return {
    getCells: function() {
      return _cells;
    },
    addChangeListener: function(listener) {
      _changeListeners.push(listener);
    },
    removeChangeListener: function(listener) {
      _changeListeners = _changeListeners.filter(function(aListener) {
        return aListener !== listener;
      });
    },
    initCells: function(size) {
      _setCells(range(size * size).map(function() {
        return {type: "off"};
      }));
    },
    activateNewCell: function() {
      var offIndexes = _findOffIndexes();
      if (offIndexes.length === 0) return false;
      var randomIndex = Math.floor(Math.random() * offIndexes.length);
      var swapIndex = offIndexes[randomIndex];
      _setCells(replaceAt(_cells, swapIndex, {type: CELL_WAIT}));
      return true;
    },
    switchCellTo: function(cell, type) {
      _setCells(_cells.map(function(aCell) {
        return aCell === cell ? {type: type} : aCell;
      }));
    },
    freezeCells: function() {
      _setCells(_cells.map(function(aCell) {
        if (aCell.type === CELL_TAP || aCell.type === CELL_WAIT)
          return {type: CELL_DONE};
        return aCell;
      }));
    },
    checkWon: function() {
      return _findOffIndexes().length === 0;
    }
  };
})();

var TimerMixin = {
  getDefaultProps: function() {
    return {countdown: 3};
  },
  getInitialState: function() {
    return {countdown: parseInt(this.props.countdown, 10)};
  },
  componentDidMount: function() {
    this._timer = setInterval(this.onSecondElapsed, 1000);
  },
  componentWillUnmount: function() {
    this.cancelTimer();
  },
  cancelTimer: function() {
    if (this._timer) clearInterval(this._timer);
  },
  onSecondElapsed: function() {
    if (this.state.countdown > 1) {
      return this.setState({countdown: this.state.countdown - 1});
    }
    this.cancelTimer();
    this.props.onTimeout(this.props.cell);
  }
};

var Cell = React.createClass({displayName: 'Cell',
  handleClick: function(event) {
    event.preventDefault();
    if (this.props.onClick) {
      this.props.onClick(this.props.cell);
    }
  },
  render: function() {
    var classes = {cell: true};
    classes[this.props.cell.type || "off"] = true;
    return (
      React.DOM.div({className: React.addons.classSet(classes), 
           onClick: this.handleClick}, 
        this.props.label ? React.DOM.p(null, this.props.label) : null, 
        this.props.countdown ? React.DOM.p(null, this.props.countdown) : null
      )
    );
  }
});

var WaitCell = React.createClass({displayName: 'WaitCell',
  mixins: [TimerMixin],
  render: function() {
    return Cell({
      cell: this.props.cell, 
      label: "WAIT", 
      countdown: this.state.countdown}
    );
  }
});

var TapCell = React.createClass({displayName: 'TapCell',
  mixins: [TimerMixin],
  render: function() {
    return Cell({
      cell: this.props.cell, 
      label: "TAP", 
      onClick: this.props.onTapped, 
      countdown: this.state.countdown}
    );
  }
});

var Overlay = React.createClass({displayName: 'Overlay',
  render: function() {
    return (
      React.DOM.div({className: "overlay"}, 
        React.DOM.h1(null, this.props.title), 
        this.props.children, 
        StartButton({onClick: this.props.onButtonClick})
      )
    );
  }
});

var StartButton = React.createClass({displayName: 'StartButton',
  render: function() {
    return React.DOM.p(null, React.DOM.button({onClick: this.props.onClick}, "Start new game"));
  }
});

var Grid = React.createClass({displayName: 'Grid',
  getDefaultProps: function() {
    return {size: 3};
  },
  getInitialState: function() {
    return {cells: []};
  },
  componentDidMount: function() {
    store.addChangeListener(this.onStoreChanged);
    store.initCells(parseInt(this.props.size, 10));
  },
  componentWillUnmount: function() {
    store.removeChangeListener(this.onStoreChanged);
    clearInterval(this._addCellTimer);
  },
  onStoreChanged: function() {
    this.setState({cells: store.getCells()});
  },
  componentWillReceiveProps: function(nextProps) {
    if (this.props.gameState !== "ongoing" && nextProps.gameState === "ongoing") {
      this.initiateGrid();
    }
  },
  initiateGrid: function() {
    store.initCells(parseInt(this.props.size, 10));
    this._addCellTimer = setInterval(this.activateNewCell, ADD_CELL_INTERVAL_SECONDS * 1000);
    this.activateNewCell();
  },
  activateNewCell: function() {
    if (!store.activateNewCell())
      return this.winGame();
  },
  onCellTapped: function(cell) {
    this.props.incrementScore();
    if (store.checkWon())
      return this.winGame();
    store.switchCellTo(cell, CELL_WAIT);
  },
  onCellTimeout: function(cell) {
    if (cell.type === CELL_TAP) {
      store.switchCellTo(cell, CELL_DEAD);
      this.gameOver(cell);
    } else {
      store.switchCellTo(cell, CELL_TAP);
    }
  },
  gameOver: function(failedCell) {
    clearInterval(this._addCellTimer);
    store.freezeCells();
    this.props.gameOver();
  },
  winGame: function() {
    clearInterval(this._addCellTimer);
    store.freezeCells();
    this.props.winGame();
  },
  _getCellComponent: function(cell, key) {
    switch(cell.type) {
      case CELL_WAIT: {
        return WaitCell({
          key: key, 
          cell: cell, 
          countdown: WAIT_CELL_TIMEOUT_SECONDS, 
          onTimeout: this.onCellTimeout}
        );
      }
      case CELL_TAP: {
        return TapCell({
          key: key, 
          cell: cell, 
          countdown: TAP_CELL_TIMEOUT_SECONDS, 
          onTimeout: this.onCellTimeout, 
          onTapped: this.onCellTapped}
        );
      }
      default: {
        return Cell({key: key, cell: cell});
      }
    }
  },
  render: function() {
    return (
      React.DOM.div({className: "grid"}, 
        this.state.cells.map(function(cell, i) {
          return this._getCellComponent(cell, i);
        }, this)
      )
    );
  }
});

var Game = React.createClass({displayName: 'Game',
  getInitialState: function() {
    return {
      gameState: "init",
      score: 0,
      best: localStorage["swwwitch.best"] || 0
    };
  },
  startGame: function() {
    this.setState({gameState: "ongoing", score: 0});
  },
  incrementScore: function() {
    var newScore = this.state.score + 1;
    var best = this.state.best;
    if (newScore > best)
       best = localStorage["swwwitch.best"] = newScore;
    this.setState({score: newScore, best: best});
  },
  winGame: function() {
    this.setState({gameState: "win"});
  },
  gameOver: function() {
    this.setState({gameState: "over"});
  },
  _renderOverlay: function() {
    switch (this.state.gameState) {
      case "init": {
        return (
          Overlay({title: "How to play?", onButtonClick: this.startGame}, 
            React.DOM.p(null, "Tap a tile when it turns green."), 
            React.DOM.p(null, "You win when no more tile is available."), 
            React.DOM.p(null, "Don’t miss any or the game ends!")
          )
        );
      }
      case "over":
      case "win": {
        return Overlay({
          title: this.state.gameState === "win" ? "You won!" : "Game Over.", 
          onButtonClick: this.startGame}, 
          React.DOM.p(null, "You scored ", this.state.score, " point(s).")
        );
      }
      default: return;
    }
  },
  render: function() {
    return (
      React.DOM.div({className: "game"}, 
        React.DOM.h1(null, "Swwwitch"), 
        React.DOM.h2(null, "Score: ", this.state.score, " — Best: ", this.state.best), 
        Grid({size: this.props.size, 
              incrementScore: this.incrementScore, 
              gameState: this.state.gameState, 
              winGame: this.winGame, 
              gameOver: this.gameOver}), 
        this._renderOverlay()
      )
    );
  }
});

React.renderComponent(Game({size: "8"}), document.body);
