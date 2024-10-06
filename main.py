from flask import Flask, request, jsonify
from math import sqrt
from scipy.optimize import minimize
import numpy as np
from flask_cors import CORS
from skimage import color

app = Flask(__name__)
CORS(app)


output = ''
available_colors = {
    'Black': {'rgba': (23, 23, 23, 1.0), 'lightfastness': 10},
    'Titanium White': {'rgba': (245, 245, 245, 1.0), 'lightfastness': 10},
    'Emerald Green': {'rgba': (6, 150, 76, 0.95), 'lightfastness': 7},
    'Lemon Yellow': {'rgba': (255, 255, 16, 1.0), 'lightfastness': 7},
    'Ultramarine': {'rgba': (4, 9, 119, 0.99), 'lightfastness': 10},
    'Phthalo Blue': {'rgba': (82, 116, 255, 0.91), 'lightfastness': 10},
    'Cerulean Blue': {'rgba': (0, 147, 248, 0.95), 'lightfastness': 10},
    'Cobalt Blue': {'rgba': (0, 130, 226, 0.95), 'lightfastness': 10},
    'Perm Blue Violet': {'rgba': (72, 11, 129, 1), 'lightfastness': 10},
    'Crimson Red': {'rgba': (255, 26, 26, 1), 'lightfastness': 7},
    'Carmine': {'rgba': (182, 0, 13, 1), 'lightfastness': 7},
    'Rose': {'rgba': (218, 58, 76, 0.95), 'lightfastness': 7},
    'Orange': {'rgba': (239, 118, 32, 0.95), 'lightfastness': 7},
    'Grey': {'rgba': (225, 209, 196, 0.95), 'lightfastness': 7},
    'Green Pale': {'rgba': (0, 145, 101, 0.95), 'lightfastness': 10},
    'Raw Umber': {'rgba': (92, 43, 10, 0.95), 'lightfastness': 10},
    'Yellow Ochre': {'rgba': (215, 160, 65, 0.95), 'lightfastness': 10},
    'Gold Ochre': {'rgba': (231, 144, 29, 0.95), 'lightfastness': 10},
    'Raw Sienna': {'rgba': (211, 138, 62, 0.95), 'lightfastness': 10},
    'Burnt Sienna': {'rgba': (200, 98, 53, 0.95), 'lightfastness': 10},
    'Naples Yellow': {'rgba': (245, 222, 81, 0.95), 'lightfastness': 10},
    'Cadmium Yellow': {'rgba': (246, 210, 5, 0.9), 'lightfastness': 7},
    'Burnt Umber': {'rgba': (50, 23, 0, 1.0), 'lightfastness': 10},
    'Vermilion': {'rgba': (244, 29, 4, 0.95), 'lightfastness': 7},
    'Viridian': {'rgba': (8, 54, 57, 0.95), 'lightfastness': 10},
    'Fluorescent Peach Red': {'rgba': (255, 112, 177, 0.95), 'lightfastness': 10},
}

color_names = list(available_colors.keys())

def rgba_to_lab(rgba):
    rgb = np.array(rgba[:3]) / 255.0
    lab = color.rgb2lab(rgb[np.newaxis, np.newaxis, :])
    return lab[0, 0, :]

# Compute LAB values for available colors
for color_name in available_colors:
    rgba = available_colors[color_name]['rgba']
    lab = rgba_to_lab(rgba)
    available_colors[color_name]['lab'] = lab

def color_distance(color1_lab, color2_lab):
    return np.linalg.norm(color1_lab - color2_lab)

def find_closest_color(available_colors, target_lab, exclude_colors=None):
    if exclude_colors is None:
        exclude_colors = []
    filtered_colors = {k: v for k, v in available_colors.items() if k not in exclude_colors}
    return min(filtered_colors, key=lambda color: color_distance(available_colors[color]['lab'], target_lab))

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
    total_ratio = sum(mix_ratios.values())
    # Normalize the ratios
    normalized_ratios = {color: ratio / total_ratio for color, ratio in mix_ratios.items()}
    # Get RGB values of the paints
    colors_rgb = np.array([available_colors[color]['rgba'][:3] for color in mix_ratios]) / 255.0
    ratios = np.array([normalized_ratios[color] for color in mix_ratios])
    # Perform subtractive mixing
    mixed_rgb = 1 - np.prod(1 - colors_rgb.T * ratios, axis=1)
    # Convert back to 0-255 range
    mixed_rgb = np.clip(mixed_rgb * 255, 0, 255).astype(int)
    # Calculate alpha
    mixed_alpha = sum(available_colors[color]['rgba'][3] * normalized_ratios[color] for color in mix_ratios)
    mixed_alpha = min(mixed_alpha, 1.0)
    return tuple(mixed_rgb.tolist() + [round(mixed_alpha, 2)])


# Function to adjust lightness in LAB color space
def adjust_lightness(lab, lighten=True, factor=0.1):
    L, a, b = lab
    if lighten:
        L = min(100, L + factor * (100 - L))
    else:
        L = max(0, L - factor * L)
    return np.array([L, a, b])

# Function to select a subset of paints (3-4) closest to the target
def select_paints(target_lab, max_paints=4):
    distances = {}
    for color_name, color_data in available_colors.items():
        dist = color_distance(color_data['lab'], target_lab)
        distances[color_name] = dist
    # Sort paints by distance
    sorted_paints = sorted(distances.items(), key=lambda x: x[1])
    # Select top paints
    selected_paints = [color_name for color_name, _ in sorted_paints[:max_paints]]
    return selected_paints



# Optimization method to calculate mixing ratios for the actual color with limited paints
def optimize_mixing_ratios(target_lab, selected_paints):
    def objective(ratios):
        ratios = np.array(ratios)
        # Normalize ratios
        total = ratios.sum()
        if total > 0:
            ratios /= total
        else:
            return np.inf  # Avoid division by zero
        colors_rgb = np.array([available_colors[color]['rgba'][:3] for color in selected_paints]) / 255.0
        # Subtractive mixing
        mixed_rgb = 1 - np.prod(1 - colors_rgb.T * ratios, axis=1)
        mixed_rgb = np.clip(mixed_rgb, 0, 1)
        # Convert to LAB
        mixed_lab = color.rgb2lab(mixed_rgb[np.newaxis, np.newaxis, :])[0, 0, :]
        # Calculate color distance
        distance = color_distance(mixed_lab, target_lab)
        return distance

    # Initial guess: Equal ratios
    initial_guess = np.array([1.0 / len(selected_paints)] * len(selected_paints))
    # Bounds: Each ratio between 0 and 1
    bounds = [(0, 1) for _ in selected_paints]
    # Constraint: Sum of ratios must be 1
    constraints = {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
    result = minimize(objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints)
    if result.success:
        ratios = result.x
        # Round small ratios to zero
        ratios = np.where(ratios < 0.01, 0, ratios)
        # Normalize again
        total = ratios.sum()
        if total > 0:
            ratios /= total
        mix_ratios = {color: round(ratios[i], 2) for i, color in enumerate(selected_paints) if ratios[i] > 0}
        return mix_ratios
    else:
        print("Optimization failed.")
        return None


# Heuristic method to calculate mixing ratios for lighter and darker mixes
def heuristic_mixing_ratios(target_lab, light_mix=True, base_color=None, shared_color=None, max_paints=4):
    mix_ratios = {color: 0 for color in available_colors}
    color_order = []
    excluded_colors = ['Black'] if light_mix else ['Titanium White']  # Avoid Black for lighter mix, Titanium White for darker mix

    # Choose a base color if not provided
    if base_color is None:
        base_color = find_closest_color(available_colors, target_lab, exclude_colors=excluded_colors)

    # Add shared color if provided
    if shared_color is None:
        shared_color = base_color

    mix_ratios[base_color] = 0.5 if light_mix else 0.55
    color_order.append(base_color)

    base_lab = available_colors[base_color]['lab']
    current_mix_lab = base_lab * mix_ratios[base_color]

    # Add secondary color
    remaining_target_lab = target_lab - current_mix_lab
    secondary_color = find_closest_color(
        {k: v for k, v in available_colors.items() if k != base_color and k != shared_color and k not in excluded_colors},
        target_lab,
        exclude_colors=excluded_colors
    )
    mix_ratios[secondary_color] = 0.2
    color_order.append(secondary_color)

    secondary_lab = available_colors[secondary_color]['lab']
    current_mix_lab += secondary_lab * mix_ratios[secondary_color]

    # Add third color
    third_color_candidates = [color for color in available_colors if color not in (base_color, secondary_color, shared_color) and color not in excluded_colors]
    if third_color_candidates and len(color_order) < max_paints:
        third_color = third_color_candidates[0]  # Choose the next closest color
        mix_ratios[third_color] = 0.1
        color_order.append(third_color)

        third_lab = available_colors[third_color]['lab']
        current_mix_lab += third_lab * mix_ratios[third_color]

    # Add fourth color if needed
    if len(color_order) < max_paints:
        fourth_color_candidates = [color for color in available_colors if color not in (base_color, secondary_color, third_color_candidates[0] if third_color_candidates else shared_color) and color not in excluded_colors]
        if fourth_color_candidates:
            fourth_color = fourth_color_candidates[0]
            mix_ratios[fourth_color] = 0.05
            color_order.append(fourth_color)

            fourth_lab = available_colors[fourth_color]['lab']
            current_mix_lab += fourth_lab * mix_ratios[fourth_color]

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
    target_lab = rgba_to_lab(target_rgba)

    # Generate Slightly Lighter Mix
    lighter_lab = adjust_lightness(target_lab, lighten=True, factor=0.05)
    selected_paints_lighter = select_paints(lighter_lab, max_paints=4)
    lighter_mix_ratios = optimize_mixing_ratios(lighter_lab, selected_paints_lighter)
    lighter_mix = {
        'ratios': lighter_mix_ratios,
        'mixed_color': calculate_mixed_color(lighter_mix_ratios)
    }

    # Actual Mix using optimization
    selected_paints_actual = select_paints(target_lab, max_paints=4)
    actual_mix_ratios = optimize_mixing_ratios(target_lab, selected_paints_actual)
    actual_mix = {
        'ratios': actual_mix_ratios,
        'mixed_color': calculate_mixed_color(actual_mix_ratios)
    }

    # Generate Slightly Darker Mix
    darker_lab = adjust_lightness(target_lab, lighten=False, factor=0.05)
    selected_paints_darker = select_paints(darker_lab, max_paints=4)
    darker_mix_ratios = optimize_mixing_ratios(darker_lab, selected_paints_darker)
    darker_mix = {
        'ratios': darker_mix_ratios,
        'mixed_color': calculate_mixed_color(darker_mix_ratios)
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
    app.run(debug=True, host='0.0.0.0', port=8030)
