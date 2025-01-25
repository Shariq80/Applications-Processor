import React from 'react';

export default function AiScoreInput({ value, onChange, min = 0, max = 10 }) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleChange = (e) => {
    const intValue = parseInt(e.target.value, 10);
    if (!isNaN(intValue) && intValue >= min && intValue <= max) {
      onChange(intValue);
    } else if (e.target.value === '') {
      onChange('');
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        type="button"
        onClick={handleDecrement}
        className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        className="w-16 text-center border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md no-arrows"
        min={min}
        max={max}
        step="1"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        +
      </button>
    </div>
  );
}