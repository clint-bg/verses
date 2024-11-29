import streamlit as st
import pandas as pd
import numpy as np
import altair as alt

st.title('verses')
st.markdown('Pick a scripture verse and see that other scriptures are similar to it.')

# Load data
@st.cache_data
def load_data():
    return pd.read_csv('data/scriptures_sub.csv')

data = load_data()
#shift all the values of tsne_x and tsne_y to positive values
data['tsne_x'] = data['tsne_x'] - data['tsne_x'].min()
data['tsne_y'] = data['tsne_y'] - data['tsne_y'].min()

# Sidebar
st.sidebar.title('Settings')
st.sidebar.markdown('Select a scripture to compare with others.')
book = st.sidebar.selectbox('Book', data['book_title'].unique(), key='book')
# Filter dataframe based on selected country
f1_df = data[data["book_title"] == book]
chapter = st.sidebar.selectbox('Chapter', f1_df['chapter_number'].unique(),key='chapter')
f2_df = f1_df[f1_df["chapter_number"] == chapter]
verse = st.sidebar.selectbox('Verse', f2_df['verse_number'].unique(),key='verse')
st.write(f'You selected {book} {chapter}:{verse}')

# Store the selected value in session state
st.session_state["selected_option"] = [book, chapter, verse]

#get data subset based on selected verse
row = f2_df[(f2_df['verse_number'] == verse)].iloc[0]
# distance from selected verse based on tsne_x and tsne_y
data['distance'] = np.sqrt((data['tsne_x'] - row['tsne_x'])**2 + (data['tsne_y'] - row['tsne_y'])**2)
# get top similar verses
top50 = data.sort_values('distance').head(50)
maxval = top50['distance'].max()
#Get subset of data that is not in the top 50
data_50 = data[~data['verse_short_title'].isin(top50['verse_short_title'])] 
top50['group'] = 'Closest 50'
data_50['group'] = 'The Rest'

#get a random subsample of the scriptures that includes the top 50 to speed up rendering
data_rand = data_50.sample(5000)
data_plot = pd.concat([data_rand, top50])


# Set highlight selection
highlight = alt.selection_multi(fields=['group'])

chart = alt.Chart(data_plot).mark_point().encode(
    alt.X('tsne_x', scale=alt.Scale(domain=[top50['tsne_x'].min()*0.9, top50['tsne_x'].max()*1.1]), axis=None),
    alt.Y('tsne_y', scale=alt.Scale(domain=[top50['tsne_y'].min()*0.9, top50['tsne_y'].max()*1.1]), axis=None),
    color=alt.condition(highlight, 'group', alt.value('lightgray')),  # Highlight selected points
    tooltip=['verse_short_title','cluster']
).add_selection(highlight).interactive()


st.markdown('---')

st.altair_chart(chart, use_container_width=True)
if st.button('Move Up'):
    #get the highest y value of the top 50
    book = 'Nephi'
    #set selected verse to the verse with the highest y value

st.markdown('---')

st.write(st.session_state)
