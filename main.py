from flask import Flask, request, jsonify
from math import sqrt
from scipy.optimize import minimize
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


output = ''
available_colors = {
    'Mars Black': {'rgba': (16, 8, 1, 1.0), 'lightfastness': 10},
    'Titanium White': {'rgba': (236, 242, 249, 1.0), 'lightfastness': 10},
    'Emerald': {'rgba': (0, 123, 38, 0.9), 'lightfastness': 7},
    'Lemon Yellow': {'rgba': (238, 222, 0, 0.9), 'lightfastness': 7},
    'Ultramarine': {'rgba': (12, 65, 155, 0.9), 'lightfastness': 10},
    'Crimson': {'rgba': (192, 0, 32, 0.9), 'lightfastness': 7},
    'Yellow Ochre': {'rgba': (209, 128, 0, 0.9), 'lightfastness': 10},
    'Cadmium Yellow': {'rgba': (246, 210, 5, 0.9), 'lightfastness': 7},
    'Burnt Umber': {'rgba': (50, 23, 0, 1.0), 'lightfastness': 10},
    'Cadmium Red': {'rgba': (222, 42, 34, 0.9), 'lightfastness': 7},
}
color_names = list(available_colors.keys())

def color_distance(color1, color2):
    return sqrt(sum((a - b) ** 2 for a, b in zip(color1, color2)))

def find_closest_color(available_colors, target_rgba, exclude_colors=None):
    if exclude_colors is None:
        exclude_colors = []
    filtered_colors = {k: v for k, v in available_colors.items() if k not in exclude_colors}
    return min(filtered_colors, key=lambda color: color_distance(available_colors[color]['rgba'], target_rgba))

# Calculate lightfastness and transparency ratings for the mixed colors
def calculate_lightfastness_and_transparency(mix_ratios):
    total_lightfastness = 0
    total_alpha = 0
    total_ratio = 0

    for color, ratio in mix_ratios.items():
        if ratio > 0:
            lightfastness = available_colors[color]['lightfastness']
            alpha = available_colors[color]['rgba'][3]
            total_lightfastness += lightfastness * ratio
            total_alpha += alpha * ratio
            total_ratio += ratio

    lightfastness_rating = round(total_lightfastness / total_ratio, 1) if total_ratio > 0 else 0
    transparency_rating = round(total_alpha, 2) if total_ratio > 0 else 0
    return lightfastness_rating, transparency_rating

# Calculate the mixed RGBA color based on mix ratios
def calculate_mixed_color(mix_ratios):
    mixed_rgb = [0, 0, 0]
    mixed_alpha = 0
    total_ratio = sum(mix_ratios.values())
    for color, ratio in mix_ratios.items():
        if ratio > 0:
            rgba = available_colors[color]['rgba']
            for i in range(3):
                mixed_rgb[i] += rgba[i] * ratio
            mixed_alpha += rgba[3] * ratio
    mixed_rgb = [min(255, max(0, round(c))) for c in mixed_rgb]
    mixed_alpha = round(mixed_alpha, 2)
    return tuple(mixed_rgb + [mixed_alpha])

# Function to adjust brightness of the target RGBA
def adjust_brightness(rgba, lighten=True, factor=0.1):
    # Convert RGB to a scale of 0-255
    r, g, b, a = rgba
    if lighten:
        r = min(255, int(r + (255 - r) * factor))
        g = min(255, int(g + (255 - g) * factor))
        b = min(255, int(b + (255 - b) * factor))
    else:
        r = max(0, int(r - r * factor))
        g = max(0, int(g - g * factor))
        b = max(0, int(b - b * factor))
    return (r, g, b, a)

# Function to select a subset of paints (3-4) closest to the target
def select_paints(target_rgba, include_black=True, include_white=True, max_paints=4):
    selected_paints = []
    
    # Include Mars Black or Titanium White based on target brightness
    brightness = sum(target_rgba[:3]) / 3
    if brightness < 128:
        if 'Mars Black' in available_colors:
            selected_paints.append('Mars Black')
    else:
        if 'Titanium White' in available_colors:
            selected_paints.append('Titanium White')
    
    # Select the remaining paints based on color distance
    remaining_paints = {k: v for k, v in available_colors.items() if k not in selected_paints}
    sorted_paints = sorted(remaining_paints.keys(), key=lambda color: color_distance(available_colors[color]['rgba'], target_rgba))
    
    for color in sorted_paints:
        if len(selected_paints) >= max_paints:
            break
        selected_paints.append(color)
    
    return selected_paints

# Optimization method to calculate mixing ratios for the actual color with limited paints
def optimize_mixing_ratios(target_rgba, selected_paints, max_paints=4):
    # Objective: Minimize the color distance between the mixed color and target_rgba
    # Variables: Ratios of each selected paint
    # Constraints:
    #   - Ratios >= 0
    #   - Sum of ratios between 0.8 and 0.95
    #   - Number of paints used <= max_paints
    
    def objective(ratios):
        mixed_rgb = np.dot(ratios, [available_colors[color]['rgba'][:3] for color in selected_paints])
        mixed_alpha = np.dot(ratios, [available_colors[color]['rgba'][3] for color in selected_paints])
        distance = sqrt(sum((mixed_rgb[i] - target_rgba[i]) ** 2 for i in range(3)) + (mixed_alpha - target_rgba[3]) ** 2)
        return distance

    # Initial guess: equal distribution within constraints
    initial_guess = np.array([1.0 / len(selected_paints)] * len(selected_paints))
    initial_guess /= initial_guess.sum()
    initial_guess *= 0.85  # Total ratio around 85%

    # Bounds for each ratio: 0 to 1
    bounds = [(0, 1) for _ in selected_paints]

    # Constraint for sum of ratios
    constraints = [
        {'type': 'ineq', 'fun': lambda x: x.sum() - 0.80},  # sum >= 0.80
        {'type': 'ineq', 'fun': lambda x: 0.95 - x.sum()}   # sum <= 0.95
    ]

    result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)

    if result.success:
        ratios = result.x
        # Round small ratios to zero
        ratios = np.where(ratios < 0.01, 0, ratios)
        # Normalize again to ensure sum is within 0.80 and 0.95
        total = ratios.sum()
        if total < 0.80:
            ratios += (0.80 - total) / len(ratios)
        elif total > 0.95:
            ratios *= 0.95 / total
        mix_ratios = {color: round(ratios[i], 2) for i, color in enumerate(selected_paints) if ratios[i] > 0}
        return mix_ratios
    else:
        print("Optimization failed. Falling back to heuristic method.")
        return heuristic_mixing_ratios(target_rgba)[0]

# Heuristic method to calculate mixing ratios for lighter and darker mixes
def heuristic_mixing_ratios(target_rgba, light_mix=True, base_color=None, shared_color=None, max_paints=4):
    mix_ratios = {color: 0 for color in available_colors}
    color_order = []
    excluded_colors = ['Mars Black'] if light_mix else ['Titanium White']  # Avoid Mars Black for lighter mix, Titanium White for darker mix

    # Choose a base color if not provided
    if base_color is None:
        base_color = find_closest_color(available_colors, target_rgba, exclude_colors=excluded_colors)

    # Add shared color if provided
    if shared_color is None:
        shared_color = base_color

    mix_ratios[base_color] = 0.5 if light_mix else 0.55
    color_order.append(base_color)

    base_rgba = available_colors[base_color]['rgba']
    current_mix = [base_rgba[i] * mix_ratios[base_color] for i in range(3)]
    current_alpha = base_rgba[3] * mix_ratios[base_color]

    # Add secondary color
    remaining_target = [max(0, target_rgba[i] - current_mix[i]) for i in range(3)]
    remaining_alpha = max(0, target_rgba[3] - current_alpha)
    secondary_color = find_closest_color(
        {k: v for k, v in available_colors.items() if k != base_color and k != shared_color and k not in excluded_colors},
        (remaining_target[0], remaining_target[1], remaining_target[2], remaining_alpha),
        exclude_colors=excluded_colors
    )
    mix_ratios[secondary_color] = 0.2
    color_order.append(secondary_color)

    secondary_rgba = available_colors[secondary_color]['rgba']
    for i in range(3):
        current_mix[i] += secondary_rgba[i] * mix_ratios[secondary_color]
    current_alpha += secondary_rgba[3] * mix_ratios[secondary_color]

    # Add third color
    third_color_candidates = [color for color in available_colors if color not in (base_color, secondary_color, shared_color) and color not in excluded_colors]
    if third_color_candidates and len(color_order) < max_paints:
        third_color = third_color_candidates[0]  # Choose the next closest color
        mix_ratios[third_color] = 0.1
        color_order.append(third_color)

        third_rgba = available_colors[third_color]['rgba']
        for i in range(3):
            current_mix[i] += third_rgba[i] * mix_ratios[third_color]
        current_alpha += third_rgba[3] * mix_ratios[third_color]

    # Add fourth color if needed
    if len(color_order) < max_paints:
        fourth_color_candidates = [color for color in available_colors if color not in (base_color, secondary_color, third_color_candidates[0] if third_color_candidates else shared_color) and color not in excluded_colors]
        if fourth_color_candidates:
            fourth_color = fourth_color_candidates[0]
            mix_ratios[fourth_color] = 0.05
            color_order.append(fourth_color)

            fourth_rgba = available_colors[fourth_color]['rgba']
            for i in range(3):
                current_mix[i] += fourth_rgba[i] * mix_ratios[fourth_color]
            current_alpha += fourth_rgba[3] * mix_ratios[fourth_color]

    # Adjust total ratios to ensure they're between 80% and 95%
    total_ratio = sum(mix_ratios.values())
    if total_ratio < 0.80:
        # Distribute the remaining ratio equally among existing paints
        remaining = 0.80 - total_ratio
        for color in mix_ratios:
            if mix_ratios[color] > 0:
                mix_ratios[color] += remaining / len([c for c in mix_ratios if mix_ratios[c] > 0])
    elif total_ratio > 0.95:
        # Scale down the ratios proportionally
        factor = 0.95 / total_ratio
        for color in mix_ratios:
            mix_ratios[color] *= factor

    # Ensure mix ratios do not exceed the maximum number of paints
    mix_ratios = {color: ratio for color, ratio in mix_ratios.items() if ratio > 0}

    return mix_ratios, color_order
def parse_rgba_string(rgba_str):
    # Convert "rgba(166, 0, 255, 1)" to (166, 0, 255, 1.0)
    rgba_values = rgba_str.replace('rgba(', '').replace(')', '').split(',')
    return tuple(int(v) if i < 3 else float(v) for i, v in enumerate(rgba_values))


# Main function to generate all mixes
def generate_mixes(target_rgba):
    output = {}

    # Generate Slightly Lighter Mix with reduced factor
    lighter_rgba = adjust_brightness(target_rgba, lighten=True, factor=0.05)  # Reduced factor
    light_mix_ratios, light_color_order = heuristic_mixing_ratios(lighter_rgba, light_mix=True)
    lighter_mix = {
        'ratios': light_mix_ratios,
        'mixed_color': calculate_mixed_color(light_mix_ratios)
    }

    # Actual Mix using optimization
    selected_paints = select_paints(target_rgba, include_black=True, include_white=True, max_paints=4)
    actual_mix_ratios = optimize_mixing_ratios(target_rgba, selected_paints, max_paints=4)
    actual_mix = {
        'ratios': actual_mix_ratios,
        'mixed_color': calculate_mixed_color(actual_mix_ratios)
    }

    # Generate Slightly Darker Mix with reduced factor
    darker_rgba = adjust_brightness(target_rgba, lighten=False, factor=0.05)  # Reduced factor
    dark_mix_ratios, dark_color_order = heuristic_mixing_ratios(darker_rgba, light_mix=False)
    darker_mix = {
        'ratios': dark_mix_ratios,
        'mixed_color': calculate_mixed_color(dark_mix_ratios)
    }

    output['lighter_mix'] = lighter_mix
    output['actual_mix'] = actual_mix
    output['darker_mix'] = darker_mix

    return output


@app.route('/post_colour', methods=['POST'])
def handle_colour_post():
    colour_data = request.json.get('colour')
    print(f"Received color: {colour_data}")
    rgba_tuple = parse_rgba_string(colour_data)
    result = generate_mixes(rgba_tuple)
    return jsonify({'status': 'success', **result})


if __name__ == '__main__':
    app.run(debug=True, host= '0.0.0.0', port=8030)
